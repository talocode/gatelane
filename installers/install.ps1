#!/usr/bin/env pwsh
param(
  [switch]$Version,
  [switch]$Help,
  [string]$Local,
  [switch]$Npm,
  [string]$Prefix
)

$VERSION = "0.1.0"
$PACKAGE = "@talocode/gatelane"

function PrintUsage {
  @"
GateLane Installer v$VERSION

Usage: install.ps1 [options]

Options:
  -Version           Print version and exit
  -Help              Print this help and exit
  -Local FILE        Install from local .tgz file
  -Npm               Install via npm (default)
  -Prefix DIR        npm install prefix

Examples:
  iex "& { $(irm https://talocode.site/install/gatelane.ps1) }"
  .\install.ps1 -Local ./talocode-gatelane-$VERSION.tgz
"@
}

function InstallViaNpm {
  Write-Host "Installing $PACKAGE@$VERSION via npm..."

  try {
    $nodeVersion = node --version
  } catch {
    Write-Error "Node.js is required. Install from https://nodejs.org"
    exit 1
  }

  try {
    $npmVersion = npm --version
  } catch {
    Write-Error "npm is required."
    exit 1
  }

  $npmArgs = @("install", "-g", "$PACKAGE@$VERSION")
  if ($Prefix) {
    $npmArgs = @("install", "--prefix", $Prefix, "$PACKAGE@$VERSION")
  }

  npm $npmArgs

  Write-Host "`nGateLane v$VERSION installed successfully!"
  Write-Host "Run 'gatelane --help' to get started."
}

function InstallLocal {
  param([string]$Tarball)

  if (-not (Test-Path $Tarball)) {
    Write-Error "File not found: $Tarball"
    exit 1
  }

  Write-Host "Installing from local tarball: $Tarball"

  $npmArgs = @("install", "-g", $Tarball)
  if ($Prefix) {
    $npmArgs = @("install", "--prefix", $Prefix, $Tarball)
  }

  npm $npmArgs

  Write-Host "`nGateLane v$VERSION installed successfully (local)!"
  Write-Host "Run 'gatelane --help' to get started."
}

function Main {
  if ($Version) {
    Write-Host "v$VERSION"
    exit 0
  }

  if ($Help) {
    PrintUsage
    exit 0
  }

  if ($Local) {
    InstallLocal -Tarball $Local
  } else {
    InstallViaNpm
  }
}

Main
