import json
import requests
import os

FIELDS = ["ID", "DOICode", "Publisher"]

ES_INDEX = "publishers"
ES_URL = "http://localhost:9200"
BULK_SIZE = 80000
INPUT_DIR = 'json_output'

def parse_row(raw):
    parts = []
    current = ''
    in_string = False
    for c in raw:
        if c == "'" and not in_string:
            in_string = True
            current += c
        elif c == "'" and in_string:
            in_string = False
            current += c
        elif c == "," and not in_string:
            parts.append(current.strip().strip("'"))
            current = ''
        else:
            current += c
    parts.append(current.strip().strip("'"))
    return parts

def ingest_to_elasticsearch_bulk(json_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        rows = json.load(f)

    bulk_payload = []
    count = 0

    for row_str in rows:
        row_values = parse_row(row_str)
        if len(row_values) != len(FIELDS):
            continue
        doc = dict(zip(FIELDS, row_values))
        doc_id = doc["ID"]

        meta = { "index": { "_index": ES_INDEX, "_id": doc_id } }
        bulk_payload.append(json.dumps(meta))
        bulk_payload.append(json.dumps(doc))
        count += 1

        if count % BULK_SIZE == 0:
            res = requests.post(f"{ES_URL}/_bulk", data='\n'.join(bulk_payload) + '\n',
                                headers={"Content-Type": "application/x-ndjson"})
            if res.status_code >= 300:
                print("Bulk insert error:", res.text)
            bulk_payload.clear()

    if bulk_payload:
        res = requests.post(f"{ES_URL}/_bulk", data='\n'.join(bulk_payload) + '\n',
                            headers={"Content-Type": "application/x-ndjson"})
        if res.status_code >= 300:
            print("Final bulk insert error:", res.text)

for i in range(35, 36):
    path = os.path.join(INPUT_DIR, f'part_{i}.json')
    if os.path.exists(path):
        print(f'Processing: {path}')
        ingest_to_elasticsearch_bulk(path)
