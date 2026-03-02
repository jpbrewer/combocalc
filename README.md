# Combo Unit Calculation Tool

## Overview

The **Combo Unit Calculation Tool** is a browser-based application embedded into our website that allows customers to enter the dimensions of a wall opening and receive intelligently designed combination unit solutions.

Based on the user’s opening width and height, the system generates valid arrangements of:

- Side lights  
- Doors  
- Cased openings  
- Transoms  

Each arrangement is designed to completely fill the opening and convert it into a functional architectural transition between rooms — for example, adding a door to separate spaces while maintaining light flow and aesthetic balance.

The tool presents multiple viable solutions, allowing users to explore different configurations and visually evaluate which arrangement best suits their needs.

---

## Core Workflow

1. **User enters opening dimensions**
   - Width and height of their wall opening
   - Additional contextual information (interior/exterior, starting condition, etc.)

2. **System generates combination unit solutions**
   - Multiple arrangements that satisfy the dimensional constraints
   - Each solution includes detailed building blocks (doors, sidelites, transoms, etc.)

3. **User explores a solution**
   - A modal opens with a rendered SVG preview
   - The arrangement is assembled from parametric building blocks
   - Users visually inspect how the unit fills their opening

4. **Future Full Solution Page**
   - From the preview modal, users will be able to navigate to a dedicated solution page
   - That page will:
     - Display the full configuration
     - Allow material and finish customization
     - Support Add to Cart
     - Support Request a Quote
     - Support Request Assistance

---

## Purpose

This tool exists to:

- Eliminate guesswork for customers
- Automatically design dimensionally valid solutions
- Reduce support burden
- Increase conversion through visualization
- Provide technically correct assemblies based on wall openings

It bridges the gap between a raw wall opening and a finished architectural transition system.

---

## Customization Roadmap

As the system evolves, users will be able to modify non-structural aspects of a selected solution without affecting the overall opening fit. Planned configurable options include:

- Glass type
- Wood species
- Stile and rail variations
- Other interior aesthetic options

These adjustments will preserve the overall dimensions while allowing personalization.

---

## Persistent Solutions & Job IDs

Each solution will ultimately be:

- Associated with a **Job ID**
- Assigned a unique **Solution ID**
- Persisted in our backend system

This allows:

- Direct linking to a specific solution
- Inclusion in formal quotes
- Sharing between customer and sales team
- Recovery of saved configurations
- Database-backed lifecycle tracking

The goal is for each full solution page to be a stable, uniquely identifiable configuration that can move seamlessly through sales, quoting, and purchasing workflows.

---

## Technical Architecture (High-Level)

- Runs entirely in the browser
- Embedded into Webflow pages
- Uses asynchronous request → poll architecture
- Renders parametric SVG previews
- Assembles modular building blocks via template-driven layout logic
- Maintains a canonical in-memory solution store

For full implementation details, see: