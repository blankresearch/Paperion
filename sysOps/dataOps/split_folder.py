import os
import random
import shutil
import sys

def split_folder(src, dst1, dst2):
    os.makedirs(dst1, exist_ok=True)
    os.makedirs(dst2, exist_ok=True)

    files = [f for f in os.listdir(src) if os.path.isfile(os.path.join(src, f))]
    random.shuffle(files)
    mid = len(files) // 2

    for f in files[:mid]:
        shutil.move(os.path.join(src, f), os.path.join(dst1, f))
    for f in files[mid:]:
        shutil.move(os.path.join(src, f), os.path.join(dst2, f))

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: python script.py <src_folder> <dst_folder1> <dst_folder2>")
        sys.exit(1)
    split_folder(sys.argv[1], sys.argv[2], sys.argv[3])
