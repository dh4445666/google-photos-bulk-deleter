import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.common.exceptions import WebDriverException

def get_resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def get_driver():
    user_data_dir = os.path.join(os.path.expanduser("~"), ".gpdt_profile")
    errors = []
    
    # Try Chrome
    try:
        options = ChromeOptions()
        options.add_argument(f"user-data-dir={user_data_dir}_chrome")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        print("Launching Chrome...")
        return webdriver.Chrome(options=options)
    except Exception as e:
        errors.append(f"Chrome error: {e}")

    # Try Edge
    try:
        options = EdgeOptions()
        options.add_argument(f"user-data-dir={user_data_dir}_edge")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        print("Launching Edge...")
        return webdriver.Edge(options=options)
    except Exception as e:
        errors.append(f"Edge error: {e}")

    # Try Firefox
    try:
        options = FirefoxOptions()
        print("Launching Firefox...")
        return webdriver.Firefox(options=options)
    except Exception as e:
        errors.append(f"Firefox error: {e}")
        
    for err in errors:
        print(err)
        
    return None

def main():
    print("========================================")
    print("  Google Photos Bulk Deleter - Standalone")
    print("========================================")

    driver = get_driver()
    if not driver:
        print("Error: Could not launch Chrome, Edge, or Firefox. Please ensure at least one is installed.")
        input("Press Enter to exit...")
        return

    print("Navigating to Google Photos...")
    driver.get("https://photos.google.com/")

    print("\n--- WAITING FOR LOGIN ---")
    print("Please log in to your Google account in the opened browser window.")
    print("Waiting until you are successfully on the Google Photos homepage...")

    # Wait until user is on photos.google.com and not a login page
    while True:
        try:
            current_url = driver.current_url
            if "photos.google.com" in current_url and "accounts.google.com" not in current_url:
                # Basic check to see if the main grid is loaded
                elements = driver.find_elements("css selector", "[role='main']")
                if len(elements) > 0:
                    break
            time.sleep(2)
        except WebDriverException:
            # Browser might have been closed by user
            print("Browser closed. Exiting.")
            return
        except KeyboardInterrupt:
            return
            
    print("\nLogged in successfully!")
    print("Injecting Google Photos Bulk Deleter tool...")

    # Read content.js
    content_js_path = get_resource_path("content.js")
    with open(content_js_path, "r", encoding="utf-8") as f:
        content_script = f.read()

    try:
        # Inject the script
        driver.execute_script(content_script)
        
        # Initialize the standalone UI
        driver.execute_script("if (window.initStandaloneBulkDeleter) window.initStandaloneBulkDeleter();")
        
        print("\nTool successfully injected!")
        print("Look for the '🗑️ Photos Delete (Pinned)' floating panel in your browser.")
        print("You can now control the deletion directly from the webpage.")
        print("\nKeep this console window open while you use the tool.")
        print("You can safely close the browser or this window when you're done.")
        
        # Keep python running while browser is open
        while True:
            try:
                driver.current_url
                time.sleep(1)
            except WebDriverException:
                print("Browser closed. Exiting script.")
                break
    except Exception as e:
        print(f"An error occurred while injecting the tool: {e}")
        input("Press Enter to exit...")

if __name__ == "__main__":
    main()
