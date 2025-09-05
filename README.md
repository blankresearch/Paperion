# Paperion

Paperion is an academic search engine. Its main goal is to find any paper ever published within seconds. <br>
Our database is built upon Elastic Search. It contains ~78 million papers metadata, including ~390,000 ingested papers, with its indexed content stored in text field. <br>
It is open source, and can be self-hosted easily on Docker.

![welcome](./docs/img/2-demo.png)

![welcome](./docs/img/5-demo.png)

See all screenshots and details at : [http://www.blankresearch.com/Paperion/](http://www.blankresearch.com/Paperion/) 


## Features

● Papers : Download ~78 million papers <br>
● Database : ~390,000 ingested papers in Elastic Search <br>
● Recommendations : Get similar papers based on content, or from same author, or same journal. <br>
● Search : Search by title and/or author and/or date -- or date range -- (more details below) <br>
● Deep Search : Search in the ingested papers content by entering a detailed description. <br>
● Collections : Organize and save papers in collections. <br>
● Notes : Highlight quotations from papers, and stick notes to them. <br>
● AI Summary : Summarize papers using OpenAI key.<br><br>

And for advanced users : <br>
● Ingestion engine to add more papers to the database. More details will be provided. 

## Installation

There are 2 ways to host Paperion locally: through Docker or manually. 

### Docker Deployment

   ```sh
   wget https://raw.githubusercontent.com/blankresearch/Paperion/refs/heads/main/docker-compose.yml 
   docker compose up
   ```
This will pull the frontend and backend in the same local network. 
The database is not yet available and will be provided soon.

### Manual Deployment


1. Host Elastic Search database on Docker 

   ```sh
   The database is not yet available and will be provided soon.
   ```

2. Download and run backend application
   ```sh
   git clone https://github.com/blankresearch/Paperion.git
   cd Paperion/backend
   pyenv install 3.10.7  
   pyenv local 3.10.7  
   python -m venv venv && source venv/bin/activate && pip install -r requirements.txt 
   uvicorn main:app --reload &
   ```

The app will start running locally, allowing you to access it via your browser at : http://localhost:8000 or http://127.0.0.1:8000

3. Run frontend application
   ```sh
   cd Paperion/frontend/paperion
   npm run dev
   ```

The will launch frontend accessible via your browser at : http://localhost:3000 or http://127.0.0.1:3000


## Contributing

The project is currently on hold from future development, but fixes will be made.

## Connect

For feedback or contributions, reach out to me:

- [LinkedIn](https://www.linkedin.com/in/yousbot/)
- [GitHub](https://github.com/yousbot)
- [Blank Research page](https://blankresearch.com/)

Made with ❤️ by Youssef.

