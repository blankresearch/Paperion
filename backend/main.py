from fastapi import FastAPI, Query
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from elasticsearch import Elasticsearch
from typing import Optional
from scihub import SciHub
import requests
import os
from user import app as user_app
from fastapi.responses import JSONResponse
import json, random
from user import get_db, auth_user
from fastapi.staticfiles import StaticFiles
import fitz

app = FastAPI()

origins = [
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://frontend:3000",
]

app.add_middleware(
	CORSMiddleware,
	allow_origins=origins,
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"]
)

app.mount("/downloads", StaticFiles(directory="downloads"), name="downloads")


@app.middleware("http")
async def add_csp_header(request, call_next):
	try:
		response = await call_next(request)
	except Exception as e:
		# Let FastAPI's exception handlers generate the response
		raise e
	if response is not None and hasattr(response, "headers"):
		response.headers["Content-Security-Policy"] = "script-src 'self' 'unsafe-inline';"
	return response

@app.get("/")
async def main():
	return JSONResponse(content={"message": "Hello World!"})
	
	
app.mount("/user", user_app) 
sh = SciHub()
es = Elasticsearch("http://paperion-elasticsearch:9200")
INDEX = "papers"

EXCLUDE_FIELDS = ["paperContent", "paper_content"]

@app.get("/getPaper")
def get_paper(title: Optional[str] = None, author: Optional[str] = None, description: Optional[str] = None,
			  doi: Optional[str] = None):
	if doi or (title and title.lower().startswith("10.")):
		doi_query = doi or title
		q = {"query": {"term": {"DOI": doi_query}}}
		res = es.search(index=INDEX, body=q, size=50)
		return res["hits"]["hits"]

	must = []
	sort = [{"_score": "desc"}]

	if title and "--" in title:
		parts = [p.strip() for p in title.split("--")]

		if len(parts) > 0 and parts[0]:
			must.append({"match": {"Title": {"query": parts[0], "operator": "or"}}})

		if len(parts) > 1 and parts[1]:
			must.append({"match": {"Author": {"query": parts[1], "operator": "or"}}})

		if len(parts) > 2 and parts[2]:
			year_sort_tokens = parts[2].split()
			if len(year_sort_tokens) > 1 and year_sort_tokens[-1].lower() in ["asc", "des", "desc"]:
				sort_dir = year_sort_tokens[-1].lower()
				if sort_dir == "asc":
					sort = [{"Year.keyword": "asc"}]
				elif sort_dir in ["des", "desc"]:
					sort = [{"Year.keyword": "desc"}]
				year_part = " ".join(year_sort_tokens[:-1])
			else:
				year_part = " ".join(year_sort_tokens)

			import re
			m = re.match(r'(<=|>=|<|>|=)?\s*(\d{4})$', year_part.strip())
			if m:
				op, year_val = m.groups()
				op = op or "="
				if op == "=":
					must.append({"term": {"Year": year_val}})
				else:
					must.append({"range": {"Year": {
						{"<": "lt", "<=": "lte", ">": "gt", ">=": "gte"}[op]: year_val
					}}})

	else:
		if title:
			must.append({"match": {"Title": {"query": title, "operator": "or"}}})
		if author:
			must.append({"match": {"Author": {"query": author, "operator": "or"}}})

	if description:
		must.append({"match": {"Abstract": {"query": description, "operator": "or"}}})

	q = {
		"query": {"bool": {"must": must}},
		"sort": sort
	}
	res = es.search(index=INDEX, body=q, size=50)
	return res["hits"]["hits"]

@app.get("/getPaperById")
def get_paper_by_id(id: str):
	query = {
		"query": {
			"term": {
				"ID": str(id)
			}
		}
	}
	res = es.search(index=INDEX, body=query, size=1)
	hits = res.get("hits", {}).get("hits", [])
	if not hits:
		raise HTTPException(status_code=404, detail="Paper not found")
	return hits[0]
		
@app.get("/getRecommendation_sameAuthor")
def get_same_author(doi: str):
	doc = es.search(index=INDEX, body={"query": {"term": {"DOI": doi}}})
	if not doc["hits"]["hits"]:
		return []
	author = doc["hits"]["hits"][0]["_source"].get("Author", "")
	q = {"query": {"match": {"Author": author}}}
	res = es.search(index=INDEX, body=q, _source={"excludes": EXCLUDE_FIELDS}, size=20)
	return res["hits"]["hits"]

@app.get("/getRecommendation_sameJournal")
def get_same_journal(doi: str):
	doc = es.search(index=INDEX, body={"query": {"term": {"DOI": doi}}})
	if not doc["hits"]["hits"]:
		return []
	journal = doc["hits"]["hits"][0]["_source"].get("Journal", "")
	q = {"query": {"match": {"Journal": journal}}}
	res = es.search(index=INDEX, body=q, _source={"excludes": EXCLUDE_FIELDS}, size=20)
	return res["hits"]["hits"]

@app.get("/SearchbyContent")
def search_by_content(query: str):
	if not query.strip():
		raise HTTPException(status_code=400, detail="Empty query")

	search_query = {
		"query": {
			"more_like_this": {
				"fields": ["paperContent"],
				"like": query,
				"min_term_freq": 1,
				"min_doc_freq": 1,
				"minimum_should_match": "60%"
			}
		},
		"size": 50
	}

	res = es.search(index=INDEX, body=search_query)
	if not res.get("hits", {}).get("hits"):
		# fallback to Title if no results
		search_query["query"]["more_like_this"]["fields"] = ["Title"]
		res = es.search(index=INDEX, body=search_query)

	return res["hits"]["hits"]


@app.get("/getPaperContent")
def get_paper_content(doi: str):
	query = {
		"_source": ["paperContent", "Title"],
		"query": {
			"term": {
				"DOI": doi
			}
		}
	}
	res = es.search(index=INDEX, body=query)  # use "papers"
	hits = res.get("hits", {}).get("hits", [])
	if not hits:
		raise HTTPException(status_code=404, detail="Paper not found")
	return hits[0]["_source"]

		
@app.get("/getRecommendation_similarPaper")
def get_similar_paper(doi: str):
	src = get_paper_content(doi)
	query_content = src.get("paperContent")
	fields = ["paperContent"]

	# fallback to Title if no paperContent
	if not query_content:
		query_content = src.get("Title")
		fields = ["Title"]

	if not query_content:
		return []

	# parameters based on field
	if fields == ["paperContent"]:
		more_like_this = {
			"fields": fields,
			"like": query_content,
			"min_term_freq": 1,
			"min_doc_freq": 1,
			"minimum_should_match": "60%",
		}
	else:  # Title fallback
		more_like_this = {
			"fields": fields,
			"like": query_content,
			"min_term_freq": 1,
			"min_doc_freq": 1,
		}

	query = {"query": {"more_like_this": more_like_this}, "size": 20}

	res = es.search(index=INDEX, body=query)
	hits = res.get("hits", {}).get("hits", [])
	return [
		{
			"Title": h["_source"].get("Title"),
			"DOI": h["_source"].get("DOI"),
			"Author": h["_source"].get("Author"),
			"Year": h["_source"].get("Year"),
			"ID": h["_source"].get("ID"),
			"Journal": h["_source"].get("Journal"),
			"paperContent": h["_source"].get("paperContent")
			or h["_source"].get("Title", ""),
		}
		for h in hits
	]

	
def _get_paper_content_by_id(pid: str) -> Optional[str]:
	q = {"query": {"term": {"ID": str(pid)}}}  
	res = es.search(index=INDEX, body=q, size=1)
	hits = res.get("hits", {}).get("hits", [])
	if not hits:
		return None
	src = hits[0]["_source"]
	return src.get("paperContent") or src.get("Title")


@app.get("/recommendations/from_collections")
def recommend_from_user_collections(token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")

	with get_db() as db:
		cur = db.execute("SELECT papers_id FROM COLLECTIONS WHERE user_id=?", (user_id,))
		rows = cur.fetchall()

	seed_ids: list[str] = []
	for row in rows:
		try:
			arr = json.loads(row[0]) if row and row[0] else []
			if isinstance(arr, list):
				seed_ids.extend(map(str, arr))
		except Exception:
			continue
	seed_ids = list(dict.fromkeys(seed_ids))

	if not seed_ids:
		paper_ids = [20919906, 37133723, 11447754, 21704052, 77082338, 76330020, 75393442, 79628753, 52198442, 21178154]
		results = []
		for pid in paper_ids:
			q = {"query": {"term": {"ID": str(pid)}}}
			res = es.search(index=INDEX, body=q, size=1)
			hits = res.get("hits", {}).get("hits", [])
			if hits:
				src = hits[0]["_source"]
				results.append({
					"Title": src.get("Title"),
					"DOI": src.get("DOI"),
					"Author": src.get("Author"),
					"Year": src.get("Year"),
					"ID": src.get("ID"),
					"Journal": src.get("Journal"),
					"paperContent": src.get("paperContent", ""),
					"_seed": None
				})
		return results

	random.shuffle(seed_ids)
	results = []
	seed_set = set(seed_ids)
	seen_rec_ids = set()
	TARGET = 40

	for pid in seed_ids:
		content = _get_paper_content_by_id(pid)
		if not content:
			continue
		k = random.randint(2, 6)
		query = {
			"query": {
				"more_like_this": {
					"fields": ["paperContent"],
					"like": content,
					"min_term_freq": 1,
					"min_doc_freq": 1,
					"minimum_should_match": "60%"
				}
			},
			"size": k
		}
		res = es.search(index=INDEX, body=query)
		for h in res.get("hits", {}).get("hits", []):
			src = h.get("_source", {})
			rec_id = str(src.get("ID") or "")
			if not rec_id or rec_id in seed_set or rec_id in seen_rec_ids:
				continue
			seen_rec_ids.add(rec_id)
			results.append({
				"Title": src.get("Title"),
				"DOI": src.get("DOI"),
				"Author": src.get("Author"),
				"Year": src.get("Year"),
				"ID": src.get("ID"),
				"Journal": src.get("Journal"),
				"paperContent": src.get("paperContent", ""),
				"_seed": pid
			})
			if len(results) >= TARGET:
				break
		if len(results) >= TARGET:
			break

	if len(results) < TARGET:
		fallback = es.search(index=INDEX, body={"query": {"match_all": {}}, "size": TARGET * 3})
		for h in fallback.get("hits", {}).get("hits", []):
			src = h.get("_source", {})
			rec_id = str(src.get("ID") or "")
			if not rec_id or rec_id in seed_set or rec_id in seen_rec_ids:
				continue
			seen_rec_ids.add(rec_id)
			results.append({
				"Title": src.get("Title"),
				"DOI": src.get("DOI"),
				"Author": src.get("Author"),
				"Year": src.get("Year"),
				"ID": src.get("ID"),
				"Journal": src.get("Journal"),
				"paperContent": src.get("paperContent", ""),
				"_seed": None
			})
			if len(results) >= TARGET:
				break

	return results[:TARGET]



@app.get("/download_paper")
def download_paper_pdf(doi: str):
	bban_url = f"https://sci.bban.top/pdf/{doi}.pdf#view=FitH"
	try:
		resp = requests.get(bban_url, stream=True, allow_redirects=False, timeout=3)
		if resp.status_code == 200:
			return {"doi": doi, "pdf_url": bban_url}
	except requests.RequestException:
		pass

	sh = SciHub()
	try:
		result = sh.fetch(doi)
		if "url" in result:
			return {"doi": doi, "pdf_url": result["url"]}
		raise HTTPException(status_code=404, detail="PDF URL not found")
	except Exception:
		raise HTTPException(status_code=500, detail="Failed to retrieve PDF URL")
		
@app.get("/save_paper")
def save_paper(doi: str):
	res = download_paper_pdf(doi)
	if "pdf_url" not in res:
		raise HTTPException(status_code=404, detail="PDF URL not found")
	url = res["pdf_url"]

	download_dir = "downloads"
	os.makedirs(download_dir, exist_ok=True)
	filename = f"{doi.replace('/', '_')}.pdf"
	filepath = os.path.join(download_dir, filename)

	try:
		pdf_resp = requests.get(url, stream=True, headers={"User-Agent": "Mozilla/5.0"})
		if pdf_resp.status_code == 200:
			with open(filepath, "wb") as f:
				for chunk in pdf_resp.iter_content(chunk_size=8192):
					if chunk:
						f.write(chunk)
			return {"doi": doi, "file_path": filepath}
	except Exception:
		pass
	raise HTTPException(status_code=500, detail="Failed to download and save PDF")

@app.get("/apa_citation")
def get_apa_citation(paper_id: str):
	query = {
		"query": {
			"term": {
				"ID": paper_id
			}
		}
	}
	res = es.search(index=INDEX, body=query, size=1)
	hits = res.get("hits", {}).get("hits", [])
	if not hits:
		raise HTTPException(status_code=404, detail="Paper not found")

	src = hits[0]["_source"]
	author = src.get("Author", "").strip()
	year = src.get("Year", "").strip()
	title = src.get("Title", "").strip()
	journal = src.get("Journal", "").strip()
	doi = src.get("DOI", "").strip()

	if not (author and year and title and journal and doi):
		raise HTTPException(status_code=400, detail="Missing fields for APA citation")

	citation = f"{author} ({year}). {title}. {journal}. https://doi.org/{doi}"
	return {"apa_citation": citation}

@app.get("/get_text_by_paper_id")
def get_text_by_paper_id(paper_id: str):
	query = {
		"_source": ["paperContent", "DOI"],
		"query": {"term": {"ID.keyword": paper_id}}
	}
	res = es.search(index=INDEX, body=query, size=1)
	hits = res.get("hits", {}).get("hits", [])
	if not hits:
		raise HTTPException(status_code=404, detail="Paper not found in index")
	
	src = hits[0]["_source"]
	content = src.get("paperContent")
	doi = src.get("DOI")
	
	if content and content.strip():
		return {"paper_id": paper_id, "text": content}
	
	pdf_info = save_paper(doi)
	pdf_path = pdf_info.get("file_path")
	if not os.path.exists(pdf_path):
		raise HTTPException(status_code=500, detail="Failed to retrieve PDF")
	
	try:
		doc = fitz.open(pdf_path)
		extracted_text = ""
		for page in doc:
			extracted_text += page.get_text()
		doc.close()
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")
	
	return {"paper_id": paper_id, "text": extracted_text}
		
if __name__ == "__main__":
	uvicorn.run(app, host="0.0.0.0", port=8000)