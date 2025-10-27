"""
Axial Coding Analysis for Music Tagger LLM Logs
Categorizes open codes into higher-level axial categories
"""

# Define the mapping from open codes to axial categories
axial_code_mapping = {

    # CATEGORY 1: ENERGY CLASSIFICATION ERRORS
    "Energy Classification Errors": [
        "Energy score is incorrect",
        "should be High instead of Medium.",
        "Energy score is incorrect. Energy should be High because of how upbeat and energetic the song is & medium energy songs are not described as being energetic.",
        "Energy is incorrect – should be Very High instead of high.",
        "Energy is off based on how Raina approaches this – should be High instead of Medium. That said",
        "this is a tricky one.",
        "Energy is incorrect – Energy should be High instead of Medium",
        "Song is described as a club banger but labelled as high energy instead of very high .",
        "Energy is incorrect - should definitely be a very high energy track meant for a club dancefloor.",
        "Energy should be very high – if it is being played in stadiums and is an arena rock track",
        "that should be taken into account.",
        "Energy should be very high instead of high",
        "Should be medium energy",
        "only feels like low energy because of the tempo but is a medium energy track",
        "Energy should be very low given there is no movement at all within it and no percussion. If it is on yoga and meditation playlists",
        "usually should be very low.",
        "should be a high energy track given how energetic the chorus is",
        "only feels medium because of tempo",
        "Has a singalong feel to it which should make it high energy at the least",
        "Energy should be medium - more of a groovy track",
        "yes you could dance to it but it is more consistent through the track energy wise.",
        "Energy should be medium - context mentions easy listening which should flag it as medium energy instead of low energy. Can we maybe consider having the reasoning specify why a track is tagged as such?",
        "Energy should be high instead of medium – catchy hook and upbeat nature of the song + overall singalong factor should bump it up",
        "Energy should be very low – track has no percussion or rhythm",
        "Energy is tricky here but should be a high energy track if you play this loud as it has a dance feel. Context mentions it as such and it should take note of that",
        "should be in very low – it even mentions it in the reasoning and should include a review step to make sure. if it's also on relaxation and calming sleep playlists",
        "should be flagged as very low.",
        "Should be tagged as low energy - very dreamy and relaxed as opposed to more upbeat.",
    ],

    # CATEGORY 2: ACCESSIBILITY CLASSIFICATION ERRORS
    "Accessibility Classification Errors": [
        "Accessibility is incorrect - should really be a Cheesy song as it is very bubble-gum like and really only has play on the radio",
        "Accessibility score is incorrect – should be cheesy instead of commercial. This is an instance where if we had a confidence score and it came back as less than 100%",
        "i would have been fine with this.",
        "Accessibility should also be Cheesy given how widespread the song is. Energy should also be very high given how anthemic the song is. Missed the most accurate subgenre which is also not on the list - 2000s Pop Punk.",
        "Should be cheesy. explicitly became a tik tok song and has one hit wonder status which is in the prompt as well.",
    ],

    # CATEGORY 3: SUBGENRE CLASSIFICATION ISSUES
    "Subgenre Classification Issues": [
        "Subgenre suggested was not in the list of provided subgenres.",
        "Did not classify it as the most accurate subgenre: 2000s Indie Rock. It mentions it multiple times in the reasoning but does not decide to classify it as such.",
        "Did not suggest most accurate subgenre description: Pop Dance. Indie Pop would have also been acceptable here.",
        "suggested a subgenre that was not on the list",
        "secondary subgenre was not correct",
        "The sub-genres that were suggested were too literal and did not take into account the wider context.",
        "Suggested EDM Classics as a secondary subgenre which is incorrect since EDM only came about in the 2010s+",
        "Secondary Subgenre suggested is not Indie Electronica",
        "first two values alone are fine.",
        "suggested the same subgenre twice",
        "Secondary subgenre - indie electronica - is incorrectly suggested",
        "Suggests 90s dance even though the song came out in the 2010s",
        "misunderstands what 90s dance or decade specific genres may refer to",
        "labelled song as 90s dance when the song came out in the 2000s",
        "Secondary subgenres suggested are inaccurate",
        "not really an edm song or a hip-hop song.",
        "Suggested a subgenre that was not from the full list",
        "Suggested modern dance but does not really fit the song",
        "Missed the most accurate subgenre - Pop Dance but overall still useful",
        "Suggested EDM Classics which is not accurate",
        "Suggests 2000s dance which is not accurate given that should be only for electronic/house music of the era",
        "best fit subgenre appeared last (2010s pop)",
        "Suggested subgenre that is not in the list of subgenres provided.",
        "Suggested Soft Rock when it is not a soft track by any means",
        "Suggested hip-hop instrumental when the track is not an instrumental track",
        "Missed the best fit subgenre for our use-case which is 2010s Indie Pop.",
        "Should not have suggested Indie Soft Pop in this use-case",
        "does not really make sense here as there are no vocals. curious as to why it did?",
        "Missed best fit subgenres like 2020s Indie Pop and Refined Covers. worth adding a note about covers and where they should be categorized.",
        "Missed best fit subgenre for our intents and purposes which is 2020s Indie Pop.",
        "it feels like the subgenre could also be modern funk too since it is a modern funk track and thats where iwould want this track to be next to all the khruangbin.",
        "Missed key subgenre which is Afro Nu-Disco. It can be Disco Edits but the other two are not a good fit. I would also argue that this is medium energy since it has a very steady beat.",
        "Subgenre should not be instrumental or instrumentally based subgenres as it has a vocal. Neo Soul or Modern Soul would be a much better fit here.",
        "Missed most accurate subgenre which is Jazz Standards",
        "Primary subgenre would be indie pop and it mentions indie soft pop instead. Indie Soft Pop should be defined accordingly",
        "Flagged Jazz & Piano and Funk & Soul Classics as a subgenres which relates to the sample in the song vs. what the actual genre of the song is.",
        "Fails to mention the most relevant subgenre: 2000s Indie Rock – it is mentioned in the context and reasoning but does mention it accordingly.",
        "Flags it as funk classics or disco edits when it is neither of them. Would rather it flag it as Disco Classics if anything",
        "Mentions Lounge/Chill Out genre in the reasoning but does not manage to pattern match it which would make it a better fit.",
        "Track should not be flagged as two types of nu-disco - defining the agnostic terms and what they mean should be helpful here.",
        "Would have also liked to see Alternative R&B – maybe it's worth defining what that term means?",
    ],

    # CATEGORY 4: REASONING & CONTEXT ISSUES
    "Reasoning & Context Issues": [
        "Reasoning suggests very clear hallucination and context dropoff. Energy is very off for this song. Should be classified as High or frankly",
        "even very High. Accessibility should also be Cheesy for this song given widespread radio fame and cultural connotations around it.",
        "Has no percussion or rhythm to it and should be flagged as very low. Reasoning mentions deep listening",
        "non instrusive soundscape",
        "Got this completely correct based off of the title alone but should have flagged it as requires human review given that it was unable to find any context about the song whatsoever",
    ],

    # CATEGORY 5: TECHNICAL ERRORS
    "Technical Errors": [
        "503 error",
        "went ahead with the search even though artist & title were not correctly input",
        "should return error value",
        "503 error due to rate limits",
        "503 rate limit error",
    ],

    # CATEGORY 6: NEEDS REVIEW / AMBIGUOUS
    "Needs Review / Ambiguous": [
        "Needs further review amongst Raina Team",
        "no issues found.",
        "Flagged it as an instrumental whne it has vocals.",
    ],
}

# Print the proposed axial categories
print("="*80)
print("PROPOSED AXIAL CODE CATEGORIES")
print("="*80)
print()

for category, codes in axial_code_mapping.items():
    print(f"\n{category.upper()}")
    print("-" * 80)
    print(f"Total codes: {len(codes)}")
    print(f"Sample codes:")
    for code in codes[:3]:
        print(f"  - {code}")

print("\n" + "="*80)
print("CATEGORY SUMMARY")
print("="*80)
for category, codes in axial_code_mapping.items():
    print(f"{category}: {len(codes)} codes")
