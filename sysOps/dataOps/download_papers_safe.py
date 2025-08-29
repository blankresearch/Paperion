import os
import json
import sys
import signal
from concurrent.futures import ProcessPoolExecutor
import argparse
from scihub import SciHub
from multiprocessing import Manager, Lock

MAX_WORKERS = 8
LOG_INTERVAL = 100
STATE_FILE = ".download_state.json"

def read_dois(path):
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def write_log(log_file, log):
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2, ensure_ascii=False)

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

def worker(task):
    doi, output_dir = task
    try:
        sh = SciHub()
        result = sh.fetch(doi)
        if 'pdf' in result:
            filename = doi.replace("/", "_") + ".pdf"
            path = os.path.join(output_dir, filename)
            with open(path, "wb") as f:
                f.write(result['pdf'])
            return (doi, filename)
        else:
            return (doi, None)
    except Exception:
        return (doi, None)

def handle_exit(sig, frame):
    print("\nInterrupted. Partial log and state saved.")
    write_log(args.log, dict(download_log))
    if last_successful_doi.value:
        save_state(args.doi, last_successful_doi.value)
    sys.exit(0)

def main():
    global args, download_log, last_successful_doi
    parser = argparse.ArgumentParser()
    parser.add_argument("-d", "--doi", required=True)
    parser.add_argument("-o", "--out", required=True)
    parser.add_argument("-l", "--log", required=True)
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    dois = read_dois(args.doi)

    state = load_state()
    start_index = resume_index(dois, state.get("last_doi")) if state.get("file") == args.doi else 0
    dois = dois[start_index:]

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    with Manager() as manager:
        download_log = manager.dict()
        last_successful_doi = manager.Value('s', '')
        counter = manager.Value('i', 0)
        lock = Lock()

        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
            tasks = [(doi, args.out) for doi in dois]
            for doi, filename in executor.map(worker, tasks):
                with lock:
                    download_log[doi] = filename
                    if filename:
                        last_successful_doi.value = doi
                    counter.value += 1
                    if counter.value % LOG_INTERVAL == 0:
                        write_log(args.log, dict(download_log))

        write_log(args.log, dict(download_log))
        if last_successful_doi.value:
            save_state(args.doi, last_successful_doi.value)

if __name__ == "__main__":
    main()
