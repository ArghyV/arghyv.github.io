type(rä)writer

A webapp that simulates an electric typewriter. Not a word processor! Being annoying to use is irrelevant.

Use cases: filling pdf forms that are not form-fillable, writing letters and documents, adding text to images

UI shows:
- a page in portrait orientation centered in the window, default position is top edge at 2/3 window height
- margin rulers on top and left edge of window
- a moving rectangular cursor touching the top right corner of page
- Toolbar with options: new, import, export, print, add page, delete page, correction tool

UI shows chosen page at 100%
If page doesn’t fit inside window, scale down
Default paper size is A4
options are common sizes between B4 and A6, including US sizes
Imported files are scaled to the nearest defined paper size option for editing and scaled back to original for export/print

New file creates window where user can define
- filename
- Page size
- Font (closest open source clones of: Prestige Elite, Letter Gothic, Univers, Bembo)
- Font size (10 pt labeled ”small”, 12 pt labeled ”large”)

Users can import one pdf or image

New file and Import wipe current pages: prompt user to export/don’t export/cancel

Arrow keys move cursor left and right, and the paper up and down
Cursor stays at fixed height as paper moves
Paper can’t completely leave the window, but can go beyond the cursor

Add page button adds a new sheet below the one nearest to the cursor
New page is the same size as the previous one
If an imported page has been scaled, new page is the same size as the editable page, and scaled up to the same size as the imported page upon export
Delete page removes the page nearest the cursor
Hotkeys ctrl+t to add and ctrl+w to delete

User can click on the rulers to add margin stops on left and right to limit cursor movement
If setting a margin stop would leave the cursor outside, it is moved inside

Imported page goes on a background layer, edits go on a second layer on top
New file simply has a paper-white background layer

Pressing letter, number or symbol keys draws corresponding sign on the page in the center of the cursor and moves the cursor forward one letter
Font is an almost black purple
Whitespace keys move the cursor or paper but don’t draw anything
Dead keys immediately draw their symbol and don’t move the cursor
Shift/cmd, alt/gr and caps lock function as usual
If the cursor is not on paper, nothing is drawn but the cursor moves as above
If the cursor is only partially on paper, draw only on paper

Files can be exported as pdf, jpg or gif
Export and printing flatten the two layers together
If exported to pdf all pages are included in the same file
If exported to jpg or gif all pages are saved as separate files, 
add page numbers to filename if more than one file

Correction tool replaces the mouse pointer with an paintbrush tool the size of the text cursor, colored very slightly more yellow than the background 