/* SPDX-License-Identifier: GPL-3.0-or-later */
/* hfdl.h — version WebAssembly (PhantomSDR-Plus) : sans struct block. */
#pragma once
#include <stdint.h>

#define SPS 3
#define HFDL_SYMBOL_RATE 1800
#define HFDL_CHANNEL_TRANSITION_BW_HZ 250

void hfdl_init_globals(void);
void hfdl_print_summary(void);
