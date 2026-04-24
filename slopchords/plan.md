Japsun rivistytin
Webapp for laying out and adding chord labels and bar lines to lyric sheets

There is a lyrics field and a layout field of roughly the same size
The lyrics field shows the lyric text and is for input and editing
The layout field shows a preview and is for editing text and chord labels as well as layout
The fields interact 

Takes plaintext file/paste as input
Keep line, paragraph and page breaks, but strip formatting
Error if input is not text

User can upload a file with a button, drag it into the lyrics field, or type or paste directly in the field

The lyrics sheet can be exported as a pdf or printed
It can be saved for later editing
Can import saved files as if they are text

Every word and break is turned into a string
Words are displayed in cells on a grid inside the layout field
The cells are transparent, the grid has a dotted background to help with alignment
This background is not exported or printed
Above each word-cell is an empty semi-transparent chord-cell for the chord label
Chord labels are strings 
Word-cells and associated chord-cells stay together even if one is moved

A word-cell can be split by inserting hyphens in the word. The split cell is divided in three cells: the first containing the string before the hyphen, one containing the hyphen, and the last containing the string after the hyphen.
Splitting a word creates new chord-cells associated with the new word-cells

A hyphen with whitespace on both sides is a separate word
A hyphen with whitespace on only one side does not split a word
The user cannot insert a hyphen adjacent to another hyphen

A word of a single underscore is transparent but still has a chord-cell as normal

User can insert a | anywhere in a string to denote a bar-line
The character is not visible in layout
Instead a muted thin line is drawn behind the text layout

The song is laid out thus:
A song is organised in lines, paragraphs and pages, denoted by breaks
A double linebreak is interpreted as a paragraph break
Lines inside a paragraph are aligned such that
- bar lines align
- If there are no bar lines, the left edges of the first not-empty chord-cells align
- Any text before the first bar line is flush right
- Text between bar lines is justified
- Text after the last bar line is flush left
- If there are no bar lines, treat the left edge of chord-cells as bars for the purposes of text alignment
- There should be a minimum of one space between any two words
Paragraphs are aligned by their first bar
If no bars, again use the left edge of the first not-empty chord-cell

A user may drag a word-cell, a chord-cell or a bar line left and right inside the layout view to reposition it
The rest of the layout moves along with it, following the rules above