import json
from elasticsearch import Elasticsearch, helpers
from elastic_transport import ConnectionTimeout

ES_URL = "http://localhost:9200"
SRC_INDEX = "economic_papers"
DST_INDEX = "papers"
BATCH_SIZE = 5000   # smaller chunk helps stability

es = Elasticsearch(ES_URL)

def migrate():
	resp = es.search(
		index=SRC_INDEX,
		query={"match_all": {}},
		size=BATCH_SIZE,
		scroll="10m",   # extend scroll context
		request_timeout=120
	)
	scroll_id = resp["_scroll_id"]

	count = 0
	batch = []

	while True:
		hits = resp["hits"]["hits"]
		if not hits:
			break

		for h in hits:
			try:
				src_doc = h["_source"]
				pid = src_doc.get("ID")
				if not pid:
					continue

				paper_content = src_doc.get("paperContent")
				if not paper_content:
					continue

				batch.append({
					"_op_type": "update",
					"_index": DST_INDEX,
					"_id": pid,
					"doc": {"paperContent": paper_content},
					"doc_as_upsert": True,
					"upsert": src_doc
				})

				if len(batch) >= BATCH_SIZE:
					helpers.bulk(es, batch, request_timeout=600)
					count += len(batch)
					print(f"{count} docs processed")
					batch = []

			except Exception as e:
				print(f"Skipping doc due to error: {e}")
				continue

		try:
			resp = es.scroll(scroll_id=scroll_id, scroll="10m", request_timeout=120)
			scroll_id = resp.get("_scroll_id")
		except ConnectionTimeout:
			print("Scroll timeout, restarting scroll from last checkpoint")
			resp = es.search(
				index=SRC_INDEX,
				query={"match_all": {}},
				size=BATCH_SIZE,
				scroll="10m",
				request_timeout=120
			)
			scroll_id = resp["_scroll_id"]
		except Exception as e:
			print(f"Scroll error: {e}")
			break

	if batch:
		helpers.bulk(es, batch, request_timeout=600)
		count += len(batch)
		print(f"{count} docs processed (final batch)")

	print(f"Migration done. {count} docs updated/inserted.")

if __name__ == "__main__":
	migrate()
