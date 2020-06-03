f = open('data.csv', "r") # train_comments
lines = f.readlines()
f.close()

new_format = ""

for line in lines: 
    new_format += "\""
    new_format += line.rstrip()
    new_format += "\",\n"

print(new_format)