import os
import time
import argparse
import shutil

def folder_stats(folder):
    total_files = 0
    total_size = 0
    for root, _, files in os.walk(folder):
        for file in files:
            if file.lower().endswith(".pdf"):
                total_files += 1
                total_size += os.path.getsize(os.path.join(root, file))
    return total_files, total_size

def get_disk_free(path):
    usage = shutil.disk_usage(path)
    return usage.free

def monitor(folder):
    prev_count, _ = folder_stats(folder)
    prev_time = time.time()
    while True:
        time.sleep(10)
        count, size = folder_stats(folder)
        now = time.time()
        elapsed = now - prev_time
        rate = (count - prev_count) / elapsed if elapsed > 0 else 0
        free_space = get_disk_free(folder)
        print(f"PDFs: {count} | Size: {size / (1024**3):.2f} GB | Free Disk: {free_space / (1024**3):.2f} GB | Rate: {rate:.2f} pdf/s")
        prev_count = count
        prev_time = now

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--f", required=True, help="Path to folder to monitor")
    args = parser.parse_args()
    monitor(args.f)
