import json
import requests
from datetime import datetime
import re

FIELDS = [
    "ID", "ISSNP", "ISSNE", "Magazine", "Abbr", "Description", "Publisher",
    "JOURNALID", "Site_URL", "CATEGORY", "SITEID_OLD", "Previous_Title",
    "Real_title", "Years", "Volumes", "Prefix", "Timeadded"
]

ES_INDEX = "magazines"
ES_URL = "http://localhost:9200"
BAD_ROWS_FILE = 'bad_rows.json'

import csv
from io import StringIO

def parse_line_smart(row):
    reader = csv.reader(StringIO(row), delimiter=',', quotechar="'", escapechar='\\')
    return next(reader)



def fix_time_format(dtstr):
    dtstr = dtstr.strip().rstrip(');')
    if not dtstr:
        return None
    try:
        return datetime.strptime(dtstr, "%Y-%m-%d %H:%M:%S").isoformat()
    except:
        return None


def insert_rows_one_by_one(bad_rows):
    for row_str in bad_rows:
        fields = parse_line_smart(row_str)
        if len(fields) != len(FIELDS):
            print("Field mismatch:", len(fields), "Row:", row_str)
            continue
        doc = dict(zip(FIELDS, fields))
        doc_id = doc["ID"]
        if doc["Timeadded"]:
            iso_date = fix_time_format(doc["Timeadded"])
            if iso_date:
                doc["Timeadded"] = iso_date
            else:
                print("Invalid date:", doc["Timeadded"])
                continue
        meta = { "index": { "_index": ES_INDEX, "_id": doc_id } }
        payload = f'{json.dumps(meta)}\n{json.dumps(doc)}\n'
        res = requests.post(f"{ES_URL}/_bulk", data=payload, headers={"Content-Type": "application/x-ndjson"})
        if res.status_code >= 300:
            print("Insert error:", res.text)

with open(BAD_ROWS_FILE, 'r', encoding='utf-8') as f:
    bad_rows = json.load(f)

insert_rows_one_by_one(bad_rows)
