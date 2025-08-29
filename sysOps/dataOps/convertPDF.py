import sys
import os
import concurrent.futures
import fitz
import time

def convert_pdf_to_txt(args):
    pdf_path, txt_path = args
    try:
        doc = fitz.open(pdf_path)
        with open(txt_path, 'w', encoding='utf-8') as f:
            for page in doc:
                f.write(page.get_text())
        return 1
    except Exception:
        return 0

def main(src_dir, dst_dir):
    os.makedirs(dst_dir, exist_ok=True)
    pdf_files = [f for f in os.listdir(src_dir) if f.lower().endswith('.pdf')]
    tasks = [(os.path.join(src_dir, f), os.path.join(dst_dir, os.path.splitext(f)[0] + '.txt')) for f in pdf_files]

    counter = 0
    start_time = time.time()
    with concurrent.futures.ProcessPoolExecutor() as executor:
        for result in executor.map(convert_pdf_to_txt, tasks):
            counter += result
            if counter % 500 == 0:
                elapsed = time.time() - start_time
                rate = counter / elapsed
                print(f"{counter} PDFs processed ({rate:.2f} PDFs/sec)")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python script.py <src_dir> <dst_dir>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
