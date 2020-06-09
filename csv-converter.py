f = open('train_comments.csv', "r") # train_comments
lines = f.readlines()
f.close()

new_format = ""
print(len(lines))

i = 0 
for line in lines: 
    if (i < 100):
        new_format += "\'"
        new_format += line.rstrip().replace("'", "\\'")
        new_format += "\',\n"
        i += 1
    else: 
        break 


text_file = open("output.txt", "w")
n = text_file.write(new_format)
text_file.close()