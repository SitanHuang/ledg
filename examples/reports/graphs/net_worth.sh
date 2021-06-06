#!/usr/bin/env sh

# Script to generate networth, assets and liability over time
# Requires: gnuplot, ledg

ledg his 'ast*' 'lia*' 'ast*|lia*' --cumulative --csv --isofull --csv-no-quotes --no-comma\
  --monthly --currency=\$ --valuation-eop --real f:2021 to:@tomorrow $@ > ~tmp.csv

(cat <<EOF) | gnuplot > ~NetWorth.svg
  set key autotitle columnhead
  set datafile separator ','

  set autoscale xy

  set terminal svg size 1000,700 enhanced background rgb 'white'

  set title 'Net Worth Over Time' font 'Times New Roman,18px'
  set ylabel 'USD'

  set xdata time
  set xtics rotate
  set timefmt "%Y-%m-%d"

  set style line 101 lw 1 lt rgb '#1400cf'
  set style line 102 lw 1 lt rgb '#b50000'
  set style line 103 lw 1 lt rgb '#007013'

  plot "~tmp.csv" using 1:2 with lines ls 101 smooth mcsplines title 'Assets', \
       "~tmp.csv" using 1:3 with lines ls 102 smooth mcsplines title 'Liability', \
       "~tmp.csv" using 1:4 with lines ls 103 smooth mcsplines title 'Net Worth'
EOF

rm ~tmp.csv
