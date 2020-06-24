f = open('train_comments.csv', "r") # train_comments
lines = f.readlines()
f.close()

# new_format = ""
print(len(lines))

###### parse csv and get toxicity 
#    var data = [["id", "text", "clean_text", "toxic_label", "toxicity_pre_clean", "toxicity_post_clean", "polarity", "politeness", "nltk_score"]];




# # + 3

# i = 0 
# for line in lines: 
#     if (i < 1500):
#         new_format += "\'"
#         new_format += line.rstrip().replace("'", "\\'").replace(";", " ")
#         new_format += "\',\n"
#         i += 1
#     else: 
#         break 


# text_file = open("output.txt", "w")
# n = text_file.write(new_format)
# text_file.close()