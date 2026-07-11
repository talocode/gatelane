#!/usr/bin/env pwsh
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
& "$DIR\installers\install.ps1" @args
