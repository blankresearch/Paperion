import os
import json
from elasticsearch import Elasticsearch, helpers

es = Elasticsearch("http://localhost:9200")
index_name = "economic_papers"
field_name = "paperContent"

# Add new searchable field
es.indices.put_mapping(
    index=index_name,
    properties={
        field_name: {
            "type": "text"
        }
    }
)

# Load reverse filename-to-DOI mapping
with open("./logs/download_log_global.json", 'r', encoding='utf-8') as f:
    doi_map = json.load(f)
rev_map = {v.replace(".pdf", ".txt"): k for k, v in doi_map.items() if v}

# Collect all .txt files
root_dir = "./PAPERS_TXT"
txt_files = []
for subdir in os.listdir(root_dir):
    full_subdir = os.path.join(root_dir, subdir)
    if os.path.isdir(full_subdir):
        for f in os.listdir(full_subdir):
            if f.endswith(".txt"):
                txt_files.append(os.path.join(full_subdir, f))

# Bulk inject content
count = 0
batch = []

for path in txt_files:
    fname = os.path.basename(path)
    doi = rev_map.get(fname)
    if not doi:
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    res = es.search(index=index_name, query={"term": {"DOI.keyword": doi}}, _source=["ID"], size=1)
    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        continue
    doc_id = hits[0]["_source"]["ID"]
    batch.append({
        "_op_type": "update",
        "_index": index_name,
        "_id": doc_id,
        "doc": {field_name: content}
    })
    count += 1
    if count % 500 == 0:
        helpers.bulk(es, batch, request_timeout=1200)
        print(f"{count} documents updated")
        batch = []

if batch:
    helpers.bulk(es, batch, request_timeout=1200)
    print(f"{count} documents updated")
