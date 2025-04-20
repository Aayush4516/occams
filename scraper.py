import os
import re
import time
from urllib.parse import urljoin, urlparse
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options

# Setup folder for saving pages
output_dir = "scraped_pages"
os.makedirs(output_dir, exist_ok=True)

# Setup headless Chrome options
options = Options()
options.add_argument("--headless=new")  # use new headless mode
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

# Ensure the correct binary path is used
driver_path = 'occam_advisory/chromedriver-linux64/chromedriver'

# Launch Selenium WebDriver
driver = webdriver.Chrome(service=Service(driver_path), options=options)

# Base URL
base_url = "https://www.occamsadvisory.com/"
driver.get(base_url)
time.sleep(3)

# Extract all anchor hrefs
anchors = driver.find_elements("tag name", "a")
urls = set()
for a in anchors:
    href = a.get_attribute("href")
    if href:
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        # Filter: same domain + remove fragments
        if parsed.netloc == urlparse(base_url).netloc:
            clean_url = full_url.split('#')[0]
            urls.add(clean_url)

# Function to sanitize filename
def sanitize_filename(url):
    parsed = urlparse(url)
    path = parsed.path.strip("/").replace("/", "_") or "home"
    if not path.endswith(".txt"):
        path += ".txt"
    filename = re.sub(r'[<>:"/\\|?*]', '', path)
    return filename

# Loop through URLs, fetch and save text content
for url in urls:
    try:
        driver.get(url)
        time.sleep(2)
        text = driver.find_element("tag name", "body").text
        filename = sanitize_filename(url)
        filepath = os.path.join(output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"Saved: {filename}")
    except Exception as e:
        print(f"Failed to process {url}: {e}")

driver.quit()
print(f"\nDone! {len(urls)} pages saved in '{output_dir}' folder.")
