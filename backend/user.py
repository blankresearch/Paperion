from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
import sqlite3
import uuid
import hashlib
import datetime
import json
from fastapi import Query
import requests
import os
import traceback
from cryptography.fernet import Fernet
from pathlib import Path
from dotenv import set_key, load_dotenv
from typing import Any, Dict
from openai import OpenAI
from fastapi.responses import JSONResponse

load_dotenv()
app = FastAPI()
DB_NAME = 'app.db'

env_path = Path(".env")
FERNET_KEY = os.environ.get("FERNET_KEY")

if not FERNET_KEY:
	FERNET_KEY = Fernet.generate_key().decode()
	if not env_path.exists():
		env_path.touch()
	set_key(str(env_path), "FERNET_KEY", FERNET_KEY)

fernet = Fernet(FERNET_KEY.encode())
	
def get_db():
	return sqlite3.connect(DB_NAME)

def auth_user(token: str):
	with get_db() as db:
		cur = db.execute("SELECT user_id FROM USERS WHERE session_token=?", (token,))
		row = cur.fetchone()
		return row[0] if row else None

class UserRegistration(BaseModel):
	username: str
	email: str
	password: str

class LoginCredentials(BaseModel):
	username: str
	password: str

class CollectionData(BaseModel):
	title: str
	description: str
	papers_id: list

class NoteData(BaseModel):
	paper_id: str
	citation: str
	description: str

class HighlightIn(BaseModel):
	page: int
	sentence: str
	pdf: str
	note: str | None = None
	
class HighlightDeleteIn(BaseModel):
	page: int
	sentence: str
	pdf: str

class APIKeyUpdate(BaseModel):
	openai_key: str

class FavParamIn(BaseModel):
	value: str

	
@app.post("/init_db")
def init_db():
	with get_db() as db:
		db.execute('''CREATE TABLE IF NOT EXISTS USERS (
				user_id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT UNIQUE,
				email TEXT UNIQUE,
				password TEXT,
				session_token TEXT,
				last_logged_in TEXT,
				saved_papers TEXT
			)''')
		db.execute('''CREATE TABLE IF NOT EXISTS COLLECTIONS (
			collection_id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			title TEXT,
			description TEXT,
			papers_id TEXT,
			FOREIGN KEY(user_id) REFERENCES USERS(user_id)
		)''')
		db.execute('''CREATE TABLE IF NOT EXISTS NOTE (
			note_id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			paper_id TEXT,
			citation TEXT,
			description TEXT,
			FOREIGN KEY(user_id) REFERENCES USERS(user_id)
		)''')
		db.execute('''CREATE TABLE IF NOT EXISTS USERAPI (
			user_id INTEGER PRIMARY KEY,
			openai_key TEXT,
			FOREIGN KEY(user_id) REFERENCES USERS(user_id)
		)''')
		db.execute('''CREATE TABLE IF NOT EXISTS ANALYSIS_CACHE (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			doi TEXT UNIQUE,
			ai_response TEXT
		)''')
		db.execute('''CREATE TABLE IF NOT EXISTS user_fav_params (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			field_1 TEXT,
			field_2 TEXT,
			field_3 TEXT,
			field_4 TEXT,
			FOREIGN KEY(user_id) REFERENCES USERS(user_id)
		)''')
	return {"message": "Database initialized."}

@app.post("/register")
def register_user(user: UserRegistration):
	encrypted_email = fernet.encrypt(user.email.encode()).decode()
	with get_db() as db:
		try:
			db.execute(
				"INSERT INTO USERS (username, email, password, saved_papers) VALUES (?, ?, ?, ?)", 
				(user.username, encrypted_email, hashlib.sha256(user.password.encode()).hexdigest(), json.dumps([]))
			)
			return {"message": "User registered successfully"}
		except:
			raise HTTPException(status_code=400, detail="User already exists")


@app.post("/login")
def login_user(credentials: LoginCredentials):
	with get_db() as db:
		cur = db.execute(
			"SELECT user_id FROM USERS WHERE username=? AND password=?", 
			(credentials.username, hashlib.sha256(credentials.password.encode()).hexdigest())
		)
		row = cur.fetchone()
		if row:
			token = str(uuid.uuid4())
			db.execute(
				"UPDATE USERS SET session_token=?, last_logged_in=? WHERE user_id=?", 
				(token, datetime.datetime.now().isoformat(), row[0])
			)
			return {"token": token}
		raise HTTPException(status_code=401, detail="Invalid credentials")

@app.post("/logout")
def logout_user(token: str):
	with get_db() as db:
		db.execute("UPDATE USERS SET session_token=NULL WHERE session_token=?", (token,))
		return {"message": "User logged out"}

@app.post("/collections")
def create_collection(collection: CollectionData, token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		db.execute(
			"INSERT INTO COLLECTIONS (user_id, title, description, papers_id) VALUES (?, ?, ?, ?)",
			(user_id, collection.title, collection.description, json.dumps(collection.papers_id))
		)
	return {"message": "Collection created"}


@app.get("/collections")
def read_collections(token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		cur = db.execute("SELECT * FROM COLLECTIONS WHERE user_id=?", (user_id,))
		return cur.fetchall()



@app.put("/collections/{collection_id}")
def update_collection(collection_id: int, collection: CollectionData, token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		db.execute(
			"UPDATE COLLECTIONS SET title=?, description=?, papers_id=? WHERE collection_id=? AND user_id=?",
			(collection.title, collection.description, json.dumps(collection.papers_id), collection_id, user_id)
		)
	return {"message": "Collection updated"}


@app.delete("/collections/{collection_id}")
def delete_collection(collection_id: int, token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		db.execute(
			"DELETE FROM COLLECTIONS WHERE collection_id=? AND user_id=?",
			(collection_id, user_id)
		)
	return {"message": "Collection deleted"}


def _resolve_doi_from_id(paper_id: str):
	try:
		pid = (paper_id or "").strip()
		if not pid:
			return None
		# If it's already a DOI, return it directly
		if pid.startswith("10.") and "/" in pid:
			return pid
		# Otherwise, treat it as an internal ID and resolve via ES
		resp = requests.get(
			"http://backend:8000/getPaperById",
			params={"id": pid},
			timeout=10
		)
		if resp.status_code != 200:
			return None
		data = resp.json() or {}
		src = data.get("_source") or {}
		doi = src.get("DOI") or src.get("Doi") or src.get("doi")
		return doi.strip() if isinstance(doi, str) and doi.strip() else None
	except Exception:
		return None

		
# add at the top with other imports	
@app.put("/collections/{collection_id}/add_paper")
def add_paper_to_collection(
	collection_id: int,
	paper_id: str,
	token: str = Query(...)
):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")

	with get_db() as db:
		cur = db.execute(
			"SELECT papers_id FROM COLLECTIONS WHERE collection_id=? AND user_id=?",
			(collection_id, user_id)
		)
		row = cur.fetchone()
		if not row:
			raise HTTPException(status_code=404, detail="Collection not found")

		try:
			papers = json.loads(row[0]) if row[0] else []
			if not isinstance(papers, list):
				papers = []
		except Exception:
			papers = []

		download = None
		paper_id = str(paper_id)

		if paper_id not in papers:
			papers.append(paper_id)
			db.execute(
				"UPDATE COLLECTIONS SET papers_id=? WHERE collection_id=? AND user_id=?",
				(json.dumps(papers), collection_id, user_id)
			)

			doi = _resolve_doi_from_id(paper_id)
			if doi:
				try:
					r = requests.get(
						"http://backend:8000/save_paper",
						params={"doi": doi},
						timeout=30
					)
					download = (
						r.json()
						if r.status_code == 200
						else {"error": r.text, "status": r.status_code}
					)
				except Exception as e:
					download = {"error": str(e)}
			else:
				download = {
					"error": "DOI not found for paper_id",
					"paper_id": paper_id
				}

		return {
			"message": "Paper added to collection",
			"papers_id": papers,
			"download": download
		}


@app.put("/collections/{collection_id}/remove_paper")
def remove_paper_from_collection(collection_id: int, paper_id: str, token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		cur = db.execute("SELECT papers_id FROM COLLECTIONS WHERE collection_id=? AND user_id=?", (collection_id, user_id))
		row = cur.fetchone()
		if not row:
			raise HTTPException(status_code=404, detail="Collection not found")
		try:
			papers = json.loads(row[0]) if row[0] else []
			if not isinstance(papers, list):
				papers = []
		except Exception:
			papers = []
		paper_id = str(paper_id)
		if paper_id in papers:
			papers.remove(paper_id)
			db.execute("UPDATE COLLECTIONS SET papers_id=? WHERE collection_id=? AND user_id=?", (json.dumps(papers), collection_id, user_id))
		return {"message": "Paper removed from collection", "papers_id": papers}


def _resolve_id_from_doi(doi: str):
	try:
		r = requests.get("http://backend:8000/getPaper", params={"doi": doi}, timeout=10)
		if r.ok:
			hits = r.json() or []
			if hits:
				return str(hits[0].get("_source", {}).get("ID") or "")
	except Exception:
		pass
	return ""

@app.post("/highlight")
def save_highlight(payload: HighlightIn, token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")

	stem = os.path.splitext(os.path.basename(payload.pdf))[0]
	doi = stem.replace("_", "/")
	
	paper_id = _resolve_id_from_doi(doi)
	if not paper_id:
		raise HTTPException(status_code=400, detail="Could not resolve ID from DOI")
	
	meta = {"page": int(payload.page), "pdf": stem}
	if payload.note:
		meta["note"] = payload.note

	with get_db() as db:
		db.execute(
			"INSERT INTO NOTE (user_id, paper_id, citation, description) VALUES (?, ?, ?, ?)",
			(user_id, paper_id, payload.sentence, json.dumps(meta))
		)
	return {"message": "Highlight saved", "paper_id": paper_id}


@app.get("/highlight")
def list_highlight(pdf: str = Query(...), token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")

	target = os.path.splitext(os.path.basename(pdf))[0]  # stem
	out = []
	with get_db() as db:
		cur = db.execute("SELECT citation, description FROM NOTE WHERE user_id=?", (user_id,))
		for citation, description in cur.fetchall():
			try:
				meta = json.loads(description or "{}")
			except Exception:
				continue
			if isinstance(meta, dict) and meta.get("pdf") == target:
				out.append({
					"page": int(meta.get("page", 1)),
					"sentence": citation,
					"note": meta.get("note", "")
				})

	return out

@app.post("/highlight/delete")
def delete_highlight(payload: HighlightDeleteIn, token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")

	stem = os.path.splitext(os.path.basename(payload.pdf))[0]
	page = int(payload.page)

	to_delete = []
	with get_db() as db:
		cur = db.execute("SELECT note_id, citation, description FROM NOTE WHERE user_id=?", (user_id,))
		for note_id, citation, description in cur.fetchall():
			if citation != payload.sentence:
				continue
			try:
				meta = json.loads(description or "{}")
			except Exception:
				continue
			if isinstance(meta, dict) and meta.get("pdf") == stem and int(meta.get("page", 0)) == page:
				to_delete.append(note_id)

		for nid in to_delete:
			db.execute("DELETE FROM NOTE WHERE note_id=? AND user_id=?", (nid, user_id))

	return {"deleted": len(to_delete)}
	
@app.post("/notes")
def create_note(token: str, note: NoteData):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		pid = note.paper_id
		if pid.startswith("10."):  # it's a DOI
			resolved_id = _resolve_id_from_doi(pid)
			if not resolved_id:
				raise HTTPException(status_code=400, detail="Could not resolve ID from DOI")
			pid = resolved_id
		db.execute(
			"INSERT INTO NOTE (user_id, paper_id, citation, description) VALUES (?, ?, ?, ?)", 
			(user_id, pid, note.citation, note.description)
		)
		return {"message": "Note created"}

@app.get("/notes")
def read_notes(token: str):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		cur = db.execute(
			"SELECT note_id, user_id, paper_id, citation, description FROM NOTE WHERE user_id=?",
			(user_id,)
		)
		notes = []
		for row in cur.fetchall():
			paper_id = row[2]
			doi = _resolve_doi_from_id(paper_id)
			notes.append({
				"note_id": row[0],
				"user_id": row[1],
				"paper_id": paper_id,
				"doi": doi,
				"citation": row[3],
				"description": row[4]
			})
		return notes


@app.get("/collections/papers")
def get_user_collection_papers(token: str):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		cur = db.execute("SELECT papers_id FROM COLLECTIONS WHERE user_id=?", (user_id,))
		all_papers = set()
		for row in cur.fetchall():
			try:
				papers_list = json.loads(row[0]) if row[0] else []
				for paper_id in papers_list:
					all_papers.add(paper_id)
			except Exception:
				continue
		return list(all_papers)


@app.put("/notes/{note_id}")
def update_note(token: str, note_id: int, note: NoteData):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		db.execute("UPDATE NOTE SET citation=?, description=? WHERE note_id=? AND user_id=?", 
				   (note.citation, note.description, note_id, user_id))
		return {"message": "Note updated"}

@app.delete("/notes/{note_id}")
def delete_note(token: str, note_id: int):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		db.execute("DELETE FROM NOTE WHERE note_id=? AND user_id=?", 
				   (note_id, user_id))
		return {"message": "Note deleted"}

@app.put("/profile")
def update_user_profile(token: str, username: str = None, email: str = None, password: str = None):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")

	with get_db() as db:
		if username:
			db.execute("UPDATE USERS SET username=? WHERE user_id=?", (username, user_id))
		if email:
			encrypted_email = fernet.encrypt(email.encode()).decode()
			db.execute("UPDATE USERS SET email=? WHERE user_id=?", (encrypted_email, user_id))
		if password:
			db.execute("UPDATE USERS SET password=? WHERE user_id=?", (hashlib.sha256(password.encode()).hexdigest(), user_id))

	return {"message": "Profile updated"}



@app.get("/profile")
def get_user_profile(token: str):
	try:
		user_id = auth_user(token)
		if not user_id:
			raise HTTPException(status_code=401, detail="Unauthorized")

		with get_db() as db:
			cur = db.execute(
				"SELECT username, email, last_logged_in FROM USERS WHERE user_id=?",
				(user_id,),
			)
			row = cur.fetchone()

			if not row:
				raise HTTPException(status_code=404, detail="User not found")

			decrypted_email = (
				fernet.decrypt(row[1].encode()).decode() if row[1] else None
			)

			return {
				"username": row[0],
				"email": decrypted_email,
				"last_logged_in": row[2],
			}

	except Exception as e:
		import traceback
		traceback.print_exc()
		raise HTTPException(
			status_code=500,
			detail=f"Failed to fetch profile ({type(e).__name__}): {str(e)}"
		)



@app.delete("/reset_profile")
def reset_user_profile(token: str):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	try:
		with get_db() as db:
			db.execute("DELETE FROM COLLECTIONS WHERE user_id=?", (user_id,))
			db.execute("DELETE FROM NOTE WHERE user_id=?", (user_id,))
			db.execute(
				"UPDATE USERS SET saved_papers=? WHERE user_id=?",
				(json.dumps([]), user_id)
			)
			# db.execute("DELETE FROM USERAPI WHERE user_id=?", (user_id,))
		return {"message": "Profile content reset successfully"}
	except Exception as e:
		print("Reset profile error:\n", traceback.format_exc())  # full stack trace
		raise HTTPException(
			status_code=500,
			detail=f"Reset profile operation failed ({type(e).__name__}): {e}"
		)




@app.put("/save_paper")
def save_paper_to_user(token: str, doi: str):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		cur = db.execute("SELECT saved_papers FROM USERS WHERE user_id=?", (user_id,))
		row = cur.fetchone()
		papers = json.loads(row[0]) if row[0] else []
		if doi not in papers:
			papers.append(doi)
			db.execute("UPDATE USERS SET saved_papers=? WHERE user_id=?", (json.dumps(papers), user_id))
		return {"message": "Paper saved"}


@app.put("/remove_paper")
def remove_saved_paper(token: str, doi: str):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		cur = db.execute("SELECT saved_papers FROM USERS WHERE user_id=?", (user_id,))
		row = cur.fetchone()
		papers = json.loads(row[0]) if row[0] else []
		if doi in papers:
			papers.remove(doi)
			db.execute("UPDATE USERS SET saved_papers=? WHERE user_id=?", (json.dumps(papers), user_id))
		return {"message": "Paper removed"}


@app.put("/update_openai_key")
def update_openai_key(token: str, data: APIKeyUpdate):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	try:
		if not data.openai_key:
			raise HTTPException(status_code=400, detail="OpenAI key is required")
		encrypted_key = fernet.encrypt(data.openai_key.encode()).decode()
		with get_db() as db:
			db.execute("""
				INSERT INTO USERAPI (user_id, openai_key) VALUES (?, ?)
				ON CONFLICT(user_id) DO UPDATE SET openai_key=excluded.openai_key
			""", (user_id, encrypted_key))
		return {"message": "OpenAI key updated successfully"}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(
			status_code=500,
			detail=f"Failed to update OpenAI key ({type(e).__name__}): {e}"
		)


@app.get("/openai_key")
def get_current_user_openai_key(token: str):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	try:
		with get_db() as db:
			cur = db.execute("SELECT openai_key FROM USERAPI WHERE user_id=?", (user_id,))
			row = cur.fetchone()
			if row and row[0]:
				decrypted_key = fernet.decrypt(row[0].encode()).decode()
				return {"openai_key": decrypted_key}
			return {"openai_key": None}
	except Exception as e:
		raise HTTPException(
			status_code=500,
			detail=f"Failed to fetch OpenAI key ({type(e).__name__}): {e}"
		)
	
@app.get("/userapi/{user_id}")
def get_user_api(user_id: int):
	with get_db() as db:
		cur = db.execute('SELECT openai_key FROM USERAPI WHERE user_id = ?', (user_id,))
		row = cur.fetchone()
		if row:
			return {"user_id": user_id, "openai_key": row['openai_key']}
		raise HTTPException(status_code=404, detail="API key not found")

@app.put("/userapi/{user_id}")
def update_user_api(user_id: int, data: APIKeyUpdate):
	with get_db() as db:
		db.execute('''
			INSERT INTO USERAPI (user_id, openai_key) VALUES (?, ?)
			ON CONFLICT(user_id) DO UPDATE SET openai_key = excluded.openai_key
		''', (user_id, data.openai_key))
		return {"message": "API key updated successfully"}
		

# OPENAI QUERY

def fetch_paper_text_by_id(pid: str):
	resp = requests.get(
		"http://backend:8000/get_text_by_paper_id",
		params={"paper_id": pid},
		timeout=10
	)
	resp.raise_for_status()
	return resp.json()

@app.post("/analyze_paper")
def analyze_paper(pdf: str = Query(...), token: str = Query(...)) -> Any:
	try:
		key_payload = get_current_user_openai_key(token)
		openai_key = (key_payload or {}).get("openai_key")
		if not openai_key:
			raise HTTPException(status_code=400, detail="No OpenAI key found for user")
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to get OpenAI key: {str(e)}")

	try:
		stem = os.path.splitext(os.path.basename(pdf))[0]
		doi = stem.replace("_", "/")
		paper_id = _resolve_id_from_doi(doi) or doi
	except Exception as e:
		raise HTTPException(status_code=400, detail=f"Invalid PDF filename for DOI: {str(e)}")

	# Check cache first
	with get_db() as db:
		cur = db.execute("SELECT ai_response FROM ANALYSIS_CACHE WHERE doi=?", (doi,))
		row = cur.fetchone()
		if row:
			try:
				return JSONResponse(content=json.loads(row[0]))
			except Exception:
				pass

	try:
		paper_data = fetch_paper_text_by_id(paper_id)
		paper_text = paper_data.get("text", "")
		if not paper_text.strip():
			raise HTTPException(status_code=404, detail="Paper text not found")
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"Failed to get paper text: {str(e)}")

	try:
		client = OpenAI(api_key=openai_key)
		prompt = f"""
		You are an academic research assistant. Analyze the following paper text and return ONLY valid JSON with the structure:
		{{
		  "summary": {{
			"research_problem": "...",
			"method": "...",
			"data_collection": "...",
			"data_analysis": "...",
			"methodological_choices": "..."
		  }},
		  "quotes": [
			{{"quote": "...", "why_important": "..."}}
		  ]
		}}
		
		Paper text:
		\"\"\"{paper_text}\"\"\"
		"""
		response = client.responses.create(model="gpt-4.1", input=prompt, temperature=0)
		parsed = json.loads(response.output_text.strip())

		# Save to cache
		with get_db() as db:
			db.execute(
				"INSERT OR REPLACE INTO ANALYSIS_CACHE (doi, ai_response) VALUES (?, ?)",
				(doi, json.dumps(parsed))
			)

		return JSONResponse(content=parsed)

	except json.JSONDecodeError:
		raise HTTPException(status_code=500, detail="Model did not return valid JSON")
	except Exception as e:
		raise HTTPException(status_code=500, detail=f"OpenAI API call failed: {str(e)}")

@app.post("/fav_params/set_field1")
def set_field1(data: FavParamIn, token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		db.execute("""
			INSERT INTO user_fav_params (user_id, field_1) VALUES (?, ?)
			ON CONFLICT(user_id) DO UPDATE SET field_1=excluded.field_1
		""", (user_id, data.value))
	return {"message": "field_1 updated", "user_id": user_id, "field_1": data.value}


@app.get("/fav_params/field1")
def get_field1(token: str = Query(...)):
	user_id = auth_user(token)
	if not user_id:
		raise HTTPException(status_code=401, detail="Unauthorized")
	with get_db() as db:
		cur = db.execute("SELECT field_1 FROM user_fav_params WHERE user_id=?", (user_id,))
		row = cur.fetchone()
		return {"user_id": user_id, "field_1": row[0] if row else None}
