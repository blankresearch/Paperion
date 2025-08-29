import os
import json
import sys
import signal
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from scihub import SciHub
import argparse

"""_usage_
    Example: python3 download_papers.py -d ../DOIs/economics_DOIs.txt -o ../DOWNLOADED_PAPERS -l ../logs/doi_filename_mapping.txt
"""

MAX_WORKERS = 96
LOG_INTERVAL = 1000
STATE_FILE = ".download_state.json"

lock = Lock()
download_log = {}
counter = 0
last_successful_doi = None

def read_dois(path):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def write_log(log_file):
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(download_log, f, indent=2, ensure_ascii=False)

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_state(doi_file, last_doi):
    state = { "file": doi_file, "last_doi": last_doi }
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f)

def resume_index(dois, last_doi):
    try:
        return dois.index(last_doi) + 1
    except ValueError:
        return 0

def handle_exit(sig, frame):
    with lock:
        if last_successful_doi:
            save_state(args.doi, last_successful_doi)
        write_log(args.log)
        print("\nInterrupted. State and log saved.")
        sys.exit(0)

def worker(doi, output_dir, log_file):
    global counter, last_successful_doi
    try:
        sh = SciHub()
        result = sh.fetch(doi)
        if 'pdf' in result:
            filename = doi.replace("/", "_") + ".pdf"
            path = os.path.join(output_dir, filename)
            with open(path, "wb") as f:
                f.write(result['pdf'])
            with lock:
                download_log[doi] = filename
                last_successful_doi = doi
        else:
            with lock:
                download_log[doi] = None
                print(f"FAILED: {doi}")
    except Exception as e:
        with lock:
            download_log[doi] = None
            print(f"ERROR: {doi} | {e}")
    with lock:
        counter += 1
        if counter % LOG_INTERVAL == 0:
            write_log(log_file)

def main():
    global args
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    parser = argparse.ArgumentParser()
    parser.add_argument("-d", "--doi", required=True, help="Path to DOI file")
    parser.add_argument("-o", "--out", required=True, help="Directory to save PDFs")
    parser.add_argument("-l", "--log", required=True, help="Path to log file")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    dois = read_dois(args.doi)

    state = load_state()
    start_index = 0
    if state.get("file") == args.doi:
        start_index = resume_index(dois, state.get("last_doi"))
    dois = dois[start_index:]

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for doi in dois:
            executor.submit(worker, doi, args.out, args.log)

    write_log(args.log)
    if last_successful_doi:
        save_state(args.doi, last_successful_doi)

if __name__ == "__main__":
    main()
