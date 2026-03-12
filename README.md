# Remote Play v2

This is a collaborative, 3D voxel-based sandbox game built with Next.js, Firebase, and three.js.

## Current Features

### Core Gameplay
- **Multiplayer Worlds:** Create new, persistent worlds or join existing ones using a unique World ID.
- **Real-Time Collaboration:** All building and player movements are synchronized in real-time between all players in a world.
- **Voxel Sandbox:** A creative building environment where you can place and break blocks to create anything you can imagine.

### Player & Character
- **Custom Player Names:** Players are prompted to enter their name before joining a world.
- **Animated Characters:** Player models are styled after classic minifigures and feature:
  - **Walking Animation:** Arms and legs swing realistically when a player moves.
  - **Head Rotation:** The character's head turns up and down to match the player's camera view.
- **Separate Sessions:** Each browser tab is treated as a unique player session, allowing a single user to join the same world multiple times with different names.

### Building System
- **Place & Break:** Instantly place or remove blocks with simple mouse clicks.
- **Ghost Block Preview:** A transparent preview of the block shows exactly where it will be placed and whether the location is valid (green for valid, red for invalid).
- **Block Rotation:** Rotate blocks before placing them using the 'R' key.
- **Extensive Block Inventory:**
  - A quick-select hotbar for the first 9 block types, accessible via number keys (1-9).
  - A full inventory modal (opened with 'I') displays all available block shapes.
- **Color Picker:** Choose from a wide palette of preset colors for your blocks via the color picker modal (opened with 'C').

### User Interface & Experience
- **World Event Log:** An on-screen panel on the right displays player chat and key world events, such as players joining or leaving.
- **Real-Time Chat:** Press 'T' to open an integrated chat input and send messages to other players in the world.
- **On-Screen Controls:** A persistent panel displays the game's keyboard and mouse controls for easy reference.
- **Immersive Audio:** Features background music and sound effects for placing and breaking blocks, with a convenient button to mute all audio.

### Technology Stack
- **Frontend:** Built with Next.js and React.
- **Backend & Real-Time Sync:** Powered by Firebase Firestore for the database and real-time data synchronization.
- **Authentication:** Utilizes Firebase Authentication for anonymous sign-in.
- **3D Rendering:** The game world and all models are rendered using `three.js`.
