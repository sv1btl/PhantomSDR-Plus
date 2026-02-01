#!/bin/bash
cd ~/PhantomSDR-Plus
killall -s 9 spectrumserver
sudo killall -s 9 rx888_stream
sleep 1

# Create fifo if does not exist or ignore
if test -e ~/PhantomSDR-Plus/rx888.fifo; then
 echo fifo alredy exists
else
 echo creating fifo...
 mkfifo ~/PhantomSDR-Plus/rx888.fifo
fi
sleep 1

RUST_BACKTRACE=1

sudo ~/PhantomSDR-Plus/rx888_stream/target/release/rx888_stream -f ~/PhantomSDR-Plus/rx888_stream/SDDC_FX3.img -s 60000000 -g 40 -a 0 -m low --pga -d -r -o - > ~/PhantomSDR-Plus/rx888.fifo &
sleep 1
~/PhantomSDR-Plus/build/spectrumserver --config ~/PhantomSDR-Plus/config-rx888mk2.toml < ~/PhantomSDR-Plus/rx888.fifo & 
# > /dev/null 2>&1 &

exit


