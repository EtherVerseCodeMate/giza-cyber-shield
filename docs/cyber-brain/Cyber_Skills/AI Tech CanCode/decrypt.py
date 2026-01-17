#decrypt.py
import pyzipper
import os

def decrypt_zip(zip_file, password, output_folder):
    try:
        # Open the encrypted ZIP file
        with pyzipper.AESZipFile(zip_file) as zf:
            # Set the password for decryption
            zf.setpassword(password.encode())
            
            # Extract all contents to the output folder
            zf.extractall(output_folder)
        
        print(f"Successfully decrypted and extracted contents to {output_folder}")
    except Exception as e:
        print(f"Error decrypting the zip file: {str(e)}")

# Example usage
zip_file = "C:\Users\Laptop218\OneDrive - University at Albany - SUNY\Documents\CTF/vault.zip"
password = "your_password"
output_folder = "C:\Users\Laptop218\OneDrive - University at Albany - SUNY\Documents\CTFD"

decrypt_zip(zip_file, password, output_folder)
