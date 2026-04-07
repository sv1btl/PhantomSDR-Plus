####----####
#!/bin/bash
cd ~/PhantomSDR-Plus
killall -s 9 spectrumserver
sudo killall -s 9 rx888_stream

sleep 1

# Turn USB powersaving off
echo on | sudo tee /sys/bus/usb/devices/*/power/control > /dev/null
if test -e ~/PhantomSDR-Plus/airspy.fifo; then
echo fifo alredy exists
else
echo creating fifo...
mkfifo ~/PhantomSDR-Plus/airspy.fifo
fi
sleep 1

RUST_BACKTRACE=1

rx_sdr -f 6956000 -s 912000 -d driver=airspyhf -F CS16 - > ~/PhantomSDR-Plus/airspy.fifo &
sleep 1
~/PhantomSDR-Plus/build/spectrumserver --config ~/PhantomSDR-Plus/config-airspyhf.toml < ~/PhantomSDR-Plus/airspy.fifo &
# > /dev/null 2>&1 &

exit
####----####
