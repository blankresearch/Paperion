import scrapy
from lxml import etree
from io import BytesIO
import os
import json

"""_usage_
    Example: DOIS_FILE=../DOIs/economics_DOIs.txt OUTPUT_FILE=../logs/economic_doi_abstracts.json scrapy runspider extract_abstract.py &> ../logs/extract_abstract.py.log
"""

class CrossrefSpider(scrapy.Spider):
    name = "crossref"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.dois_file = os.getenv("DOIS_FILE")
        self.output_file = os.getenv("OUTPUT_FILE")
        if not self.dois_file or not self.output_file:
            raise ValueError("DOIS_FILE and OUTPUT_FILE environment variables must be set")
        self.buffer = []
        self.count = 0
        self.total = 0
        self.empty = 0
        self.batch_size = 100
        open(self.output_file, "w").close()

    def start_requests(self):
        with open(self.dois_file) as f:
            for line in f:
                doi = line.strip()
                if doi:
                    url = f"https://doi.org/{doi}"
                    yield scrapy.Request(
                        url,
                        headers={"Accept": "application/vnd.crossref.unixsd+xml"},
                        meta={"doi": doi},
                        callback=self.parse_metadata
                    )

    def parse_metadata(self, response):
        doi = response.meta["doi"]
        parser = etree.XMLParser(recover=True)
        tree = etree.parse(BytesIO(response.body), parser)
        ns = {
            "cr": "http://www.crossref.org/xschema/1.1",
            "jats": "http://www.ncbi.nlm.nih.gov/JATS1"
        }
        abstract_parts = tree.xpath("//jats:abstract//jats:p", namespaces=ns)
        abstract = " ".join([etree.tostring(p, method="text", encoding="unicode").strip() for p in abstract_parts])
        self.total += 1
        if not abstract:
            self.empty += 1
        item = {"DOI": doi, "abstract": abstract}
        self.buffer.append(item)
        self.count += 1
        if self.count % self.batch_size == 0:
            self.flush_batch()

    def close(self, reason):
        if self.buffer:
            self.flush_batch()
        if self.total > 0:
            percent = (self.empty / self.total) * 100
            print(f"Empty abstracts: {self.empty}/{self.total} ({percent:.2f}%)")

    def flush_batch(self):
        with open(self.output_file, "a") as f:
            for item in self.buffer:
                f.write(json.dumps(item) + "\n")
        self.buffer.clear()
