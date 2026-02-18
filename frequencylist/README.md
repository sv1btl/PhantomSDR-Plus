# How to update markers.json

- Unzip the file "frequencylist.zip" into the folder cd $HOME/PhantomSDR-Plus/frequencylist/.
- Modify the file "manual-markers.json" with your own markers.
- download from https://new.hfcc.org/data/ the newest list, at the buttom of page, current: **B25allx2.zip** - B25 Operational Schedule - **Last updated on 08-Jan-2026** 
- unzip the downloaded file from the database into the folder frequencylist.
- ensure that "B25all00.TXT" and "broadcas.txt" are located in the "frequencylist" folder
- modify "update-markers.sh" line 5 to your personal full path -->  "cd $HOME/PhantomSDR-Plus/frequencylist/". Make this file executable.
- **NB** don't use '~ ' if you use the cron service e.g. use cd home/user/PhantomSDR-Plus/frequencylist/
- run update script with "update-markers.sh" manually or let it run automaticly by a cron job (for example update every 15 minutes a hour 'sudo crontab -e' and enter '0,15,30,45 * * * * /usr/bin/bash /home/user/PhantomSDR-Plus/frequencylist/update-markers.sh')
- The script will generate the "shortwavestations.json" based on the data given from the database and finaly will merge it with "manual-markers.json", so to create the final "markers.json" in the root PhantomSDR-Plus folder).
- **NB** Your markers in mymarkers.json will overwrite and replace the duplicate markers from shortwavestations.json in the final markers.json file which will be generated. The given mymarkers.json contains some demo markers, you can replace them with your own!
