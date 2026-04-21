import base64

print("Starting...")

with open("face.jpg", "rb") as f:
    data = f.read()
    print("File size:", len(data))   # DEBUG
    img = base64.b64encode(data).decode()

print("Base64 length:", len(img))   # DEBUG
print(img)