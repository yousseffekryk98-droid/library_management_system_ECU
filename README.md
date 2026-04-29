Desktop Application (Python/PyQt6)
As you specifically requested a Python desktop version, I have also provided the full source code and compilation instructions in a separate file within this project.
Requirements: Located in requirements.txt.
Python Code: Located in DESKTOP_PYTHON_CODE.md.
Compile Command:
code
Bash
pyinstaller --noconsole --onefile --name "LibraryMasterPro" main.py
🛠️ How to use the Web Preview:
Use the Sidebar to navigate between Inventory, Borrowing, Users, and Settings.
Switch languages using the Globe icon or the button in the Settings tab.
Access the database using the default admin credentials: username: admin, password: admin123.
The system is now ready for use and testing in the live preview. 


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
