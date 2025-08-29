import json
from elasticsearch import Elasticsearch
import time

FILE_PATH = "../logs/economic_doi_abstracts_cleaned.json"
INDEX_NAME = "economic_papers"
BATCH_SIZE = 3000

es = Elasticsearch("http://localhost:9200")

def read_json_objects(path):
    with open(path, "r", encoding="utf-8") as f:
        buffer = ""
        for line in f:
            buffer += line.strip()
            if buffer.endswith("}"):
                try:
                    obj = json.loads(buffer)
                    if obj.get("abstract"):
                        yield obj
                except json.JSONDecodeError:
                    pass
                buffer = ""

def generate_batches(iterator, size):
    batch = []
    for item in iterator:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch

for batch in generate_batches(read_json_objects(FILE_PATH), BATCH_SIZE):
    for entry in batch:
        doi = entry["DOI"].lower()
        abstract = entry["abstract"]
        es.update_by_query(index=INDEX_NAME, body={
            "script": {
                "source": "ctx._source.Abstract = params.abstract",
                "lang": "painless",
                "params": {"abstract": abstract}
            },
            "query": {
                "term": {"DOI.keyword": doi}
            }
        }, conflicts="proceed")
    print(f"Updated batch of {len(batch)} entries.")
