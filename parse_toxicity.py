f = open('report.csv', "r") # train_comments
lines = f.readlines()
f.close()

toxic_label = 3
toxicity_pre_clean = 4
toxicity_post_clean = 5

n_pre = []
n_post = []
y_pre = []
y_post = []

i = 0
for line in lines: 
    if (i < 10):
        data = line.split(";")

        toxic = data[toxic_label]
        if (toxic == 'n'): 
            n_pre.append(float(data[toxicity_pre_clean]))
            n_post.append(float(data[toxicity_post_clean]))
        elif (toxic == 'y'):
            y_pre.append(float(data[toxicity_pre_clean]))
            y_post.append(float(data[toxicity_post_clean]))
        else: 
            print("toxic has other value: ", toxic)

        i += 1


n_pre_avg = sum(n_pre)/ len(n_pre)
n_post_avg = sum(n_post)/ len(n_post)
y_pre_avg = sum(y_pre)/ len(y_pre)
y_post_avg = sum(y_post)/ len(y_post)


print("n_pre_avg: ", n_pre_avg)
print("n_post_avg: ", n_post_avg)
print("y_pre_avg: ", y_pre_avg)
print("y_post_avg: ", y_post_avg)