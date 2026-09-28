import {TextInputContextProvider} from '../hooks/useTextInputContextProvider';
import InquiryFormViewModal from '../viewmodals/inquiryFormViewModal';
import InquiryFormAskSubmitModal from './inquiryFormAskSubmitModal';
import InquiryFormSubmitCompletedModal from './inquiryFormSubmitCompletedModal';
import InquiryFormSubmitFailedModal from './inquiryFormSubmitFailedModal';

const InquiryFormModalItems = () => {
  return (
    <TextInputContextProvider>
      <InquiryFormAskSubmitModal />
      <InquiryFormViewModal />
      <InquiryFormSubmitCompletedModal />
      <InquiryFormSubmitFailedModal />
    </TextInputContextProvider>
  );
};

export default InquiryFormModalItems;
