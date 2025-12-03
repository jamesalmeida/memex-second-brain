import React from 'react';
import { observer } from '@legendapp/state/react';
import AssistantChat from '../../src/components/AssistantChat';

const AssistantScreen = observer(() => {
  return <AssistantChat />;
});

export default AssistantScreen;
