#!/bin/bash

# Volzo MVP - Install Flutter and Run Rider App
# This script will install Flutter SDK and run the rider app

set -e

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║         Installing Flutter SDK and Running Rider App                ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if Flutter is already installed
echo -e "${BLUE}Step 1: Checking for existing Flutter installation...${NC}"
if command -v flutter &> /dev/null; then
    echo -e "${GREEN}✅ Flutter is already installed!${NC}"
    flutter --version
else
    echo -e "${YELLOW}⚠️  Flutter not found. Installing...${NC}"
    
    # Step 2: Download Flutter
    echo -e "${BLUE}Step 2: Downloading Flutter SDK (1.5GB, this will take a few minutes)...${NC}"
    cd ~/Downloads
    
    if [ ! -f "flutter_macos_arm64_3.24.5-stable.zip" ]; then
        curl -O https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/flutter_macos_arm64_3.24.5-stable.zip
        echo -e "${GREEN}✅ Download complete!${NC}"
    else
        echo -e "${GREEN}✅ Flutter zip already downloaded!${NC}"
    fi
    
    # Step 3: Extract Flutter
    echo -e "${BLUE}Step 3: Extracting Flutter...${NC}"
    if [ ! -d "flutter" ]; then
        unzip -q flutter_macos_arm64_3.24.5-stable.zip
        echo -e "${GREEN}✅ Extraction complete!${NC}"
    else
        echo -e "${GREEN}✅ Flutter already extracted!${NC}"
    fi
    
    # Step 4: Move to Applications
    echo -e "${BLUE}Step 4: Moving Flutter to /Applications...${NC}"
    if [ ! -d "/Applications/flutter" ]; then
        sudo mv flutter /Applications/
        echo -e "${GREEN}✅ Flutter moved to /Applications!${NC}"
    else
        echo -e "${GREEN}✅ Flutter already in /Applications!${NC}"
    fi
    
    # Step 5: Add to PATH
    echo -e "${BLUE}Step 5: Adding Flutter to PATH...${NC}"
    if ! grep -q "/Applications/flutter/bin" ~/.zshrc; then
        echo 'export PATH="$PATH:/Applications/flutter/bin"' >> ~/.zshrc
        echo -e "${GREEN}✅ Flutter added to PATH!${NC}"
    else
        echo -e "${GREEN}✅ Flutter already in PATH!${NC}"
    fi
    
    # Reload PATH
    export PATH="$PATH:/Applications/flutter/bin"
    
    # Step 6: Run Flutter Doctor
    echo -e "${BLUE}Step 6: Running Flutter Doctor...${NC}"
    flutter doctor
fi

echo ""
echo -e "${GREEN}✅ Flutter installation complete!${NC}"
echo ""

# Step 7: Install Xcode Command Line Tools (if needed)
echo -e "${BLUE}Step 7: Checking Xcode Command Line Tools...${NC}"
if ! xcode-select -p &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installing Xcode Command Line Tools...${NC}"
    xcode-select --install
    echo -e "${YELLOW}⚠️  Please complete the Xcode installation and run this script again.${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Xcode Command Line Tools installed!${NC}"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    Running Rider App                                 ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Step 8: Navigate to rider app
echo -e "${BLUE}Step 8: Navigating to Rider App...${NC}"
cd "/Users/saketsmac/Desktop/Volzo MVP/rider-app"
echo -e "${GREEN}✅ In rider app directory!${NC}"

# Step 9: Get Flutter dependencies
echo -e "${BLUE}Step 9: Getting Flutter dependencies...${NC}"
flutter pub get
echo -e "${GREEN}✅ Dependencies installed!${NC}"

# Step 10: Open iOS Simulator
echo -e "${BLUE}Step 10: Opening iOS Simulator...${NC}"
open -a Simulator &
sleep 5
echo -e "${GREEN}✅ Simulator opening...${NC}"

# Step 11: Check for devices
echo -e "${BLUE}Step 11: Checking for available devices...${NC}"
flutter devices

echo ""
echo -e "${GREEN}✅ Everything is ready!${NC}"
echo ""
echo -e "${BLUE}Step 12: Running Rider App...${NC}"
echo -e "${YELLOW}⚠️  This will launch the app. Press Ctrl+C to stop.${NC}"
echo ""

# Step 12: Run the app
flutter run

echo ""
echo -e "${GREEN}✅ Done!${NC}"
