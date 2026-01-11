from collections import defaultdict
import json
broadcastersFile = open('broadcas.txt',encoding="ISO-8859-1")
frequenciesFile = open('B25all00.TXT')

broadcasters = {}
for broadcaster in broadcastersFile:
    if broadcaster[0] != ';':
        k, v = broadcaster.rstrip().split(" ", 1)
        broadcasters[k] = v

frequencies = defaultdict(set)
for frequency in frequenciesFile:
    if frequency[0] != ';':
        f = int(frequency[:5])
        b = frequency[117:120]
        frequencies[f].add(b)

for k in frequencies.keys():
    frequencies[k] = "\n".join(sorted(broadcasters[x] for x in frequencies[k]))

frequenciesSorted = []
for k, v in sorted(frequencies.items()):
    frequenciesSorted.append({"frequency": k*1000, "name": v, "mode": "AM"})

json.dump(frequenciesSorted, open('shortwavestations.json','w'), indent=4)


#download from https://new.hfcc.org/data/ the newest list, at the buttom of page, here: "B25allx2.zip - B25 Operational Schedule - Last updated on 20-Dec-2025"
#unzip the downloaded file, here: "B25allx2.zip"
#move "B25all00.TXT" and "broadcas.txt" at the "frequencylist" folder
#edit the file "generateshortwave.py"
#modify line 4 for the current file name, here : "B25all00.TXT"
#modify line 24 to "frequenciesSorted.append({"frequency": k*1000, "name": v, "mode": "AM"})"
#run script with "python3 generateshortwave.py"
#extend or replace the file "markers.json" with the new generated file "shortwavestations.json"

