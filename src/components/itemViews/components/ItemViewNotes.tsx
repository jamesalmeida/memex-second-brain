import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Item } from '../../../types';
import { itemsActions } from '../../../stores/items';
import InlineEditableText from '../../InlineEditableText';

interface NotesSectionProps {
  item: Item;
  isDarkMode: boolean;
  onNotesChange?: (notes: string) => void;
}

const NotesSection: React.FC<NotesSectionProps> = ({ item, isDarkMode, onNotesChange }) => {
  const [notes, setNotes] = useState<string>(item.notes || '');

  const handleSaveNotes = async (newNotes: string) => {
    setNotes(newNotes);
    await itemsActions.updateItemWithSync(item.id, { notes: newNotes });
    onNotesChange?.(newNotes);
  };

  return (
    <View style={styles.notesSection}>
      <Text style={[styles.notesSectionLabel, isDarkMode && styles.notesSectionLabelDark]}>
        NOTES
      </Text>
      <InlineEditableText
        value={notes}
        placeholder="Tap to add your notes..."
        onSave={handleSaveNotes}
        style={[styles.notesText, isDarkMode && styles.notesTextDark]}
        multiline
        minLines={4}
        isDarkMode={isDarkMode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  notesSection: {
    marginBottom: 20,
  },
  notesSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#666',
    marginBottom: 8,
  },
  notesSectionLabelDark: {
    color: '#999',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  notesTextDark: {
    color: '#CCC',
  },
});

export default NotesSection;
