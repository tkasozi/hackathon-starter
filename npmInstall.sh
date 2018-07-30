#!/bin/bash
file="node_moduless"
if [ ! -d "$file" ]
then
    echo "Installing node modules"
    npm install && npm start
    echo "APP started!"
fi