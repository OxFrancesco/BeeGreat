import { Redirect } from 'expo-router';

/**
 * The mic tab never navigates: its trigger prevents selection and toggles
 * voice recording instead. This screen only exists because every trigger
 * needs a route behind it — redirect home if it's ever reached.
 */
export default function MicScreen() {
  return <Redirect href="/" />;
}
