#!/bin/bash

if type update-alternatives >/dev/null 2>&1; then
  update-alternatives --remove \
    'one-person-lab-preview' \
    '/opt/One Person Lab Preview/one-person-lab-preview' || true
else
  rm -f '/usr/bin/one-person-lab-preview'
fi

apparmor_profile='/etc/apparmor.d/one-person-lab-preview'
if [ -f "$apparmor_profile" ]; then
  rm -f "$apparmor_profile"
fi
