
# How to use generateshortwave.py

- download from https://new.hfcc.org/data/ the newest list, at the buttom of page, here: "B25allx2.zip - B25 Operational Schedule - Last updated on 20-Dec-2025"
- unzip the downloaded file, here: "B25allx2.zip"
- move "B25all00.TXT" and "broadcas.txt" at the "frequencylist" folder
- edit the file "generateshortwave.py"
- modify line 4 for the current file name, here : "B25all00.TXT"
- modify line 24 to "frequenciesSorted.append({"frequency": k*1000, "name": v, "mode": "AM"})"
- run script with "python3 generateshortwave.py"
- extend or replace the file "markers.json" with the new generated file "shortwavestations.json"
