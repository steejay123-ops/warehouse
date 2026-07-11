import requests
import time

def test():
    url = "http://127.0.0.1:8000/api/test_stream/"
    print("Sending request...")
    start_time = time.time()
    with requests.get(url, stream=True) as r:
        print(f"Headers received at {time.time() - start_time:.2f}s")
        for line in r.iter_lines():
            if line:
                print(f"[{time.time() - start_time:.2f}s] {line.decode('utf-8')}")

if __name__ == "__main__":
    test()
