#!/bin/bash

# Volzo Rider App - Quick Flutter Installation
# Run this script to install Flutter and launch the rider app

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║              Volzo Rider App - Flutter Installation                 ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Flutter is already installed
if command -v flutter &> /dev/null; then
    echo -e "${GREEN}✅ Flutter is already installed!${NC}"
    flutter --version
    echo ""
    echo -e "${BLUE}Skipping installation, going straight to running the app...${NC}"
    echo ""
else
    echo -e "${YELLOW}📦 Flutter not found. Installing now...${NC}"
    echo ""
    
    # Download Flutter
    echo -e "${BLUE}Step 1/5: Downloading Flutter SDK (1.5GB)...${NC}"
    echo -e "${YELLOW}This will take 2-5 minutes depending on your internet speed${NC}"
    cd ~/Downloads
    
    if [ -f "flutter_macos_arm64_3.24.5-stable.zip" ]; then
        echo -e "${GREEN}✅ Flutter zip already downloaded!${NC}"
    else
        curl -L -o flutter_macos_arm64_3.24.5-stable.zip https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/flutter_macos_arm64_3.24.5-stable.zip
        echo -e "${GREEN}✅ Download complete!${NC}"
    fi
    
    # Extract
    echo ""
    echo -e "${BLUE}Step 2/5: Extracting Flutter...${NC}"
    if [ -d "flutter" ]; then
        rm -rf flutter
    fi
    unzip -q flutter_macos_arm64_3.24.5-stable.zip
    echo -e "${GREEN}✅ Extraction complete!${NC}"
    
    # Move to Applications
    echo ""
    echo -e "${BLUE}Step 3/5: Moving Flutter to /Applications...${NC}"
    if [ -d "/Applications/flutter" ]; then
        sudo rm -rf /Applications/flutter
    fi
    sudo mv flutter /Applications/
    echo -e "${GREEN}✅ Flutter moved to /Applications!${NC}"
    
    # Add to PATH
    echo ""
    echo -e "${BLUE}Step 4/5: Adding Flutter to PATH...${NC}"
    if ! grep -q "/Applications/flutter/bin" ~/.zshrc; then
        echo '' >> ~/.zshrc
        echo '# Flutter SDK' >> ~/.zshrc
        echo 'export PATH="$PATH:/Applications/flutter/bin"' >> ~/.zshrc
        echo -e "${GREEN}✅ Flutter added to PATH!${NC}"
    else
        echo -e "${GREEN}✅ Flutter already in PATH!${NC}"
    fi
    
    # Reload PATH
    export PATH="$PATH:/Applications/flutter/bin"
    
    # Run Flutter Doctor
    echo ""
    echo -e "${BLUE}Step 5/5: Running Flutter Doctor...${NC}"
    flutter doctor
    
    echo ""
    echo -e "${GREEN}✅ Flutter installation complete!${NC}"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    Launching Rider App                               ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to rider app
echo -e "${BLUE}📱 Preparing Rider App...${NC}"
cd "/Users/saketsmac/Desktop/Volzo MVP/rider-app"

# Get dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
flutter pub get
echo -e "${GREEN}✅ Dependencies installed!${NC}"

# Open iOS Simulator
echo ""
echo -e "${BLUE}📱 Opening iOS Simulator...${NC}"
open -a Simulator &
sleep 3

# Check devices
echo ""
echo -e "${BLUE}🔍 Checking for available devices...${NC}"
flutter devices

echo ""
echo -e "${GREEN}✅ Everything is ready!${NC}"
echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  The Rider App will now launch in the iOS Simulator                 ║${NC}"
echo -e "${YELLOW}║                                                                      ║${NC}"
echo -e "${YELLOW}║  What you'll see:                                                    ║${NC}"
echo -e "${YELLOW}║  1. Splash Screen (Volzo logo)                                       ║${NC}"
echo -e "${YELLOW}║  2. Login Page (phone number)                                        ║${NC}"
echo -e "${YELLOW}║  3. Home Page with Google Maps                                       ║${NC}"
echo -e "${YELLOW}║  4. Book a Ride button                                               ║${NC}"
echo -e "${YELLOW}║  5. All features working!                                            ║${NC}"
echo -e "${YELLOW}║                                                                      ║${NC}"
echo -e "${YELLOW}║  Press Ctrl+C to stop the app                                        ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Run the app
flutter run

echo ""
echo -e "${GREEN}✅ Done! Thanks for using Volzo! 🚀${NC}"
