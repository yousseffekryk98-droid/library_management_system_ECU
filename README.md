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

⚙️ How to turn the code into an .exe
Once AI Studio gives you the Python code, you can easily turn it into an executable file on your machine:

Create a new folder and save the AI's code into a file called main.py.

Open your terminal in that folder and install the required libraries:
pip install PyQt6 pandas openpyxl pyinstaller

Run this command to generate the .exe:
pyinstaller --noconfirm --onedir --windowed --name "LibrarySystem" "main.py"

Once it finishes, you will find an .exe file inside the dist folder. You can zip that folder and send it directly to the library doctor!


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
