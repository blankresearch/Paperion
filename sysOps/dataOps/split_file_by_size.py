def split_file(input_file="dois.txt", parts=4):
    with open(input_file, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
    chunk_size = len(lines) // parts
    for i in range(parts):
        start = i * chunk_size
        end = None if i == parts - 1 else (i + 1) * chunk_size
        with open(f"dois_part_{i+1}.txt", "w", encoding="utf-8") as out:
            out.write("\n".join(lines[start:end]))

if __name__ == "__main__":
    split_file()
