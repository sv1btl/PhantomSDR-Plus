#!/bin/bash
cd ~/PhantomSDR-Plus
#/home/pi/xgo.sh
killall -s 9 spectrumserver
sleep 1

# Create fifo if does not exist or ignore
if test -e ~/PhantomSDR-Plus/rtl.fifo; then
 echo fifo alredy exists
else
 echo creating fifo...
 mkfifo ~/PhantomSDR-Plus/rtl.fifo
fi
sleep 1

# RUST_BACKTRACE=1

~/PhantomSDR-Plus/build/spectrumserver build/spectrumserver --config config-rtl.toml &
# > /dev/null 2>&1 &

exit

#!/bin/bash



