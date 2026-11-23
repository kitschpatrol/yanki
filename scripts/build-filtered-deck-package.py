# /// script
# requires-python = ">=3.13"
# dependencies = ["anki==26.9.3"]
# ///
"""Build an Anki package with notes already pulled into filtered decks.

No AnkiConnect action can create or rebuild a filtered deck, so the filtered
deck tests import a package made by this script instead. It reads a JSON
scenario from stdin (written by build-filtered-deck-packages.ts) and writes the
package to the scenario's output path.
"""

import json
import sys
import tempfile
from pathlib import Path

from anki.collection import Collection, ExportAnkiPackageOptions
from anki.consts import MODEL_CLOZE

scenario = json.load(sys.stdin)

with tempfile.TemporaryDirectory() as directory:
    col = Collection(str(Path(directory) / "collection.anki2"))

    for definition in scenario["models"]:
        model = col.models.new(definition["modelName"])
        if definition.get("isCloze"):
            model["type"] = MODEL_CLOZE
        for field in definition["inOrderFields"]:
            col.models.add_field(model, col.models.new_field(field))
        for index, card_template in enumerate(definition["cardTemplates"], start=1):
            template = col.models.new_template(f"Card {index}")
            template["qfmt"], template["afmt"] = card_template["Front"], card_template["Back"]
            col.models.add_template(model, template)
        col.models.add(model)

    for source in scenario["notes"]:
        note = col.new_note(col.models.by_name(source["modelName"]))
        for field, value in source["fields"].items():
            note[field] = value
        note.tags = source["tags"]
        col.add_note(note, col.decks.id(source["deckName"]))

    for definition in scenario["filteredDecks"]:
        filtered = col.sched.get_or_create_filtered_deck(deck_id=0)
        filtered.name = definition["name"]
        filtered.config.search_terms[0].search = definition["search"]
        filtered.config.search_terms[0].limit = 1000
        col.sched.add_or_update_filtered_deck(filtered)

    col.export_anki_package(
        out_path=scenario["output"],
        options=ExportAnkiPackageOptions(with_scheduling=True, with_media=False, legacy=True),
        limit=None,
    )
    col.close()
