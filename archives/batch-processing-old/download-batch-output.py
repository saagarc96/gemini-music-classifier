#!/usr/bin/env python3
"""
Download batch output file using Python SDK
The Python google-genai SDK has better support for batch file downloads
"""

import os
import sys
from google import genai

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def download_batch_output(batch_name):
    """Download batch output file using Python SDK"""

    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ Error: GEMINI_API_KEY not found in environment")
        sys.exit(1)

    # Initialize client
    client = genai.Client(api_key=api_key)

    print(f"📥 Retrieving batch job: {batch_name}\n")

    try:
        # Get batch job (without read_responses since it's not supported)
        batch = client.batches.get(name=batch_name)

        print(f"✅ Batch job retrieved!")
        print(f"📊 State: {batch.state}")
        print(f"📝 Display name: {batch.display_name}")

        # Get the output file name from dest
        if hasattr(batch, 'dest') and hasattr(batch.dest, 'file_name'):
            file_name = batch.dest.file_name
            print(f"📁 Output file: {file_name}\n")

            # Download the file using the file parameter
            print(f"Downloading file content...")
            file_data = client.files.download(file=file_name)

            # Save to outputs directory (absolute path from script location)
            script_dir = os.path.dirname(os.path.abspath(__file__))
            project_root = os.path.dirname(script_dir)
            output_path = os.path.join(project_root, "outputs", "batch-output.jsonl")
            with open(output_path, 'wb') as f:
                f.write(file_data)

            print(f"✅ Saved successfully!")
            print(f"📁 File: {output_path}")
            print(f"📊 Size: {len(file_data)} bytes\n")

            return output_path
        else:
            print(f"⚠️  No output file found in batch.dest")
            print(f"Batch dest: {batch.dest}")
            sys.exit(1)

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    # Batch job name
    batch_name = "batches/atdpuj01cvry22of15w27crr43vuipp3zypt"

    if len(sys.argv) > 1:
        batch_name = sys.argv[1]

    download_batch_output(batch_name)
