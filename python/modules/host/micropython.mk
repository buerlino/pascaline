# SPDX-License-Identifier: GPL-3.0-or-later
# MicroPython user C module `_host` (see host.c). Needs Asyncify (python/variant/pascaline).
HOST_MOD_DIR := $(USERMOD_DIR)
SRC_USERMOD_C += $(HOST_MOD_DIR)/host.c
