from elasticsearch import Elasticsearch

es = Elasticsearch("http://localhost:9200")

query_text = "Kundratiev Innovation Inventions"

query = {
    "query": {
        "more_like_this": {
            "fields": ["paperContent"],
            "like": query_text,
            "min_term_freq": 1,
            "min_doc_freq": 1,
            "minimum_should_match": "60%"
        }
    },
    "size": 10
}

res = es.search(index="economic_papers", body=query)
for hit in res["hits"]["hits"]:
    print(f"\nTitle: {hit['_source'].get('Title')}")
    print(f"DOI: {hit['_source'].get('DOI')}")
    abstract = hit['_source'].get('paperContent')
    if abstract:
        print(f"Content: {abstract[:1000]}")
        print(" --------------------------------")
    else:
        print("Abstract: Not available")

